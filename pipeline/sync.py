"""Supabase sync: read the store registry, upsert products, log pipeline runs.

Talks straight to Supabase's PostgREST API with `requests` — no SDK dependency.
Reads can use the anon key (RLS allows SELECT on stores); writes require the
service_role key, which bypasses RLS.

Upsert rules (spec):
- keyed on (store_id, external_id); only scraped columns are sent, so tagger
  fields (vibes etc.) and first_seen are never clobbered.
- products of a *successfully scraped* store that weren't seen in this run get
  in_stock = false (never deleted — history has future value).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import requests

# Public by design: the anon key ships in the frontend. Lets dry runs read the
# store registry before the service key secret exists. Overridable via env.
DEFAULT_SUPABASE_URL = "https://dywrisybvcorpfhbwgtg.supabase.co"
DEFAULT_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5d3Jpc3lidmNvcnBmaGJ3Z3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDEyMzcsImV4cCI6MjA5NTg3NzIzN30."
    "FgI4VqSYuInl2RDOzeNB4BLVTkYI-PaB7up0JTXmcnw"
)


class SyncError(Exception):
    pass


class Supa:
    def __init__(self):
        self.url = (os.environ.get("SUPABASE_URL") or DEFAULT_SUPABASE_URL).rstrip("/")
        self.service_key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        self.anon_key = (os.environ.get("SUPABASE_ANON_KEY") or DEFAULT_ANON_KEY).strip()

    @property
    def can_write(self) -> bool:
        return bool(self.service_key)

    def _headers(self, write: bool) -> dict:
        key = self.service_key if write else (self.service_key or self.anon_key)
        if write and not key:
            raise SyncError("SUPABASE_SERVICE_ROLE_KEY is not set (needed for writes)")
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def _rest(self, path: str) -> str:
        return f"{self.url}/rest/v1/{path}"

    def active_stores(self) -> list[dict]:
        resp = requests.get(
            self._rest("stores"),
            params={"active": "eq.true", "select": "id,slug,provider"},
            headers=self._headers(write=False),
            timeout=30,
        )
        if resp.status_code != 200:
            raise SyncError(f"reading stores failed: HTTP {resp.status_code} {resp.text[:300]}")
        return resp.json()

    def upsert_products(self, store_id: str, products: list[dict]) -> int:
        """Upsert one store's scraped products. Returns count written."""
        if not products:
            return 0
        now = datetime.now(timezone.utc).isoformat()
        rows = []
        for p in products:
            rows.append(
                {
                    "store_id": store_id,
                    "external_id": p["external_id"],
                    "name": p["name"],
                    "brand": p["brand"],
                    "category": p["category"],
                    "strain_type": p["strain_type"],
                    "thc_pct": p["thc_pct"],
                    "cbd_pct": p["cbd_pct"],
                    "variants": p["variants"],
                    "price_min": p["price_min"],
                    "url": p["url"],
                    "image_url": p["image_url"],
                    "in_stock": True,
                    "last_seen": now,
                }
            )
        resp = requests.post(
            self._rest("products"),
            params={"on_conflict": "store_id,external_id"},
            headers={**self._headers(write=True), "Prefer": "resolution=merge-duplicates"},
            json=rows,
            timeout=60,
        )
        if resp.status_code not in (200, 201, 204):
            raise SyncError(f"upsert failed: HTTP {resp.status_code} {resp.text[:300]}")
        return len(rows)

    def mark_unseen_out_of_stock(self, store_id: str, run_start_iso: str) -> None:
        """After a successful store scrape, anything not touched this run is
        out of stock. Only called for stores that scraped OK (fail-soft)."""
        resp = requests.patch(
            self._rest("products"),
            params={
                "store_id": f"eq.{store_id}",
                "last_seen": f"lt.{run_start_iso}",
                "in_stock": "eq.true",
            },
            headers=self._headers(write=True),
            json={"in_stock": False},
            timeout=60,
        )
        if resp.status_code not in (200, 204):
            raise SyncError(f"out-of-stock pass failed: HTTP {resp.status_code} {resp.text[:300]}")

    def log_run(
        self,
        stores_ok: int,
        stores_failed: int,
        products_seen: int,
        notes: str,
    ) -> None:
        resp = requests.post(
            self._rest("pipeline_runs"),
            headers=self._headers(write=True),
            json={
                "stores_ok": stores_ok,
                "stores_failed": stores_failed,
                "products_seen": products_seen,
                "products_tagged": 0,
                "notes": notes,
            },
            timeout=30,
        )
        if resp.status_code not in (200, 201, 204):
            raise SyncError(f"pipeline_runs insert failed: HTTP {resp.status_code} {resp.text[:300]}")
