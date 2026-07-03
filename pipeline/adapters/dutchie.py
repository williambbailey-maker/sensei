"""Dutchie adapter: fetch a store's category page and parse the embedded JSON.

Dutchie is Next.js — the page ships complete structured product records inside
the __NEXT_DATA__ script tag (Apollo cache). We parse that, never the rendered
DOM. The Apollo cache layout shifts between Dutchie deploys, so extraction is
deliberately structure-agnostic: recursively walk the whole JSON blob and
collect every dict whose __typename is Product.

Normalized product shape (shared by all adapters):
  {store_slug, provider, external_id, name, brand, category, strain_type,
   thc_pct, cbd_pct, variants: [{weight, price}], url, image_url, raw}
"""

from __future__ import annotations

import json
import re
from typing import Any

BASE = "https://dutchie.com"

CATEGORIES = [
    "flower",
    "pre-rolls",
    "vaporizers",
    "edibles",
    "concentrates",
    "tinctures",
    "topicals",
]

MAX_PAGES_PER_CATEGORY = 8

_NEXT_DATA_RE = re.compile(
    r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL
)


def category_url(store_slug: str, category: str, page: int = 0) -> str:
    url = f"{BASE}/dispensary/{store_slug}/products/{category}"
    if page:
        url += f"?page={page}"
    return url


def _extract_next_data(html: str) -> dict:
    m = _NEXT_DATA_RE.search(html)
    if not m:
        raise ValueError("__NEXT_DATA__ script tag not found")
    return json.loads(m.group(1))


def _walk_products(node: Any, out: dict[str, dict]) -> None:
    if isinstance(node, dict):
        if node.get("__typename") == "Product":
            pid = str(node.get("id") or node.get("_id") or "")
            if pid:
                # Later occurrences may be fuller records; keep the larger one.
                prev = out.get(pid)
                if prev is None or len(json.dumps(node)) > len(json.dumps(prev)):
                    out[pid] = node
        for v in node.values():
            _walk_products(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk_products(v, out)


def _first(d: dict, *keys: str) -> Any:
    for k in keys:
        v = d.get(k)
        if v not in (None, "", []):
            return v
    return None


def _num(v: Any) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        m = re.search(r"[\d.]+", v)
        if m:
            try:
                return float(m.group(0))
            except ValueError:
                return None
    return None


def _potency(raw: dict, *content_keys: str) -> float | None:
    """Pull a potency % out of Dutchie's several potency encodings."""
    for k in content_keys:
        v = raw.get(k)
        if isinstance(v, dict):
            rng = v.get("range")
            if isinstance(rng, list) and rng:
                return _num(rng[-1])
            n = _num(v.get("value"))
            if n is not None:
                return n
        n = _num(v)
        if n is not None:
            return n
    return None


def _variants(raw: dict) -> list[dict]:
    options = raw.get("Options") or raw.get("options") or []
    prices = raw.get("Prices") or raw.get("prices") or []
    special = raw.get("specialPrices") or []
    out = []
    if isinstance(options, list) and isinstance(prices, list) and options:
        for i, weight in enumerate(options):
            price = _num(prices[i]) if i < len(prices) else None
            entry = {"weight": weight, "price": price}
            if i < len(special) and _num(special[i]) is not None:
                entry["special_price"] = _num(special[i])
            out.append(entry)
    elif isinstance(prices, list) and prices:
        out = [{"weight": None, "price": _num(p)} for p in prices]
    return [v for v in out if v.get("price") is not None or v.get("weight")]


def normalize(raw: dict, store_slug: str, category: str) -> dict:
    brand = raw.get("brand")
    brand_name = None
    if isinstance(brand, dict):
        brand_name = _first(brand, "name", "Name")
    brand_name = brand_name or _first(raw, "brandName", "BrandName")

    cname = _first(raw, "cName", "cname")
    url = f"{BASE}/dispensary/{store_slug}/product/{cname}" if cname else None

    image = _first(raw, "Image", "image")
    if not image:
        images = raw.get("images")
        if isinstance(images, list) and images:
            first_img = images[0]
            image = first_img.get("url") if isinstance(first_img, dict) else first_img

    variants = _variants(raw)
    prices = [v["price"] for v in variants if v.get("price") is not None]

    return {
        "store_slug": store_slug,
        "provider": "dutchie",
        "external_id": str(raw.get("id") or raw.get("_id")),
        "name": _first(raw, "Name", "name"),
        "brand": brand_name,
        "category": _first(raw, "type", "Type") or category,
        "strain_type": _first(raw, "strainType", "StrainType"),
        "thc_pct": _potency(raw, "THCContent", "THC"),
        "cbd_pct": _potency(raw, "CBDContent", "CBD"),
        "variants": variants,
        "price_min": min(prices) if prices else None,
        "url": url,
        "image_url": image,
        "raw": raw,
    }


def parse_category_page(html: str, store_slug: str, category: str) -> list[dict]:
    data = _extract_next_data(html)
    found: dict[str, dict] = {}
    _walk_products(data, found)
    return [normalize(r, store_slug, category) for r in found.values()]


def scrape_store_category(fetcher, store_slug: str, category: str) -> list[dict]:
    """Fetch all pages of one store's category. Pagination is respected by
    requesting ?page=N until a page adds no new products (or the cap)."""
    seen: dict[str, dict] = {}
    for page in range(MAX_PAGES_PER_CATEGORY):
        html = fetcher.fetch(category_url(store_slug, category, page))
        products = parse_category_page(html, store_slug, category)
        new = [p for p in products if p["external_id"] not in seen]
        for p in new:
            seen[p["external_id"]] = p
        # A page with no products at all, or no new ones, ends the walk.
        if not new:
            break
        # Dutchie shows up to ~100 per page; fewer means this was the last page.
        if len(products) < 50:
            break
    return list(seen.values())
