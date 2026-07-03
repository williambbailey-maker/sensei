"""Local Dutchie scraper — RUN THIS ON YOUR OWN COMPUTER, not in the cloud.

Why local: Dutchie is behind Cloudflare, which blocks datacenter IPs (GitHub
Actions, cloud servers) but trusts residential IPs like your home internet.
This is William's proven scraper (a visible Chromium doing DOM scraping) — it
works from a home machine. The only change from the old CSV script: it also
upserts into Supabase so the website has live data. A CSV backup is still saved.

Setup (once):
    pip install playwright requests
    python -m playwright install chromium

Run:
    export SUPABASE_SERVICE_ROLE_KEY="...service role key from Supabase dashboard..."
    # optional: export SUPABASE_URL="https://<project>.supabase.co"   (defaults set)
    python local_scrape.py

Store list comes from Supabase (active stores). Manage stores there, not here.
"""

from __future__ import annotations

import csv
import hashlib
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from playwright.sync_api import sync_playwright  # noqa: E402

import sync as sync_mod  # noqa: E402

CATEGORIES = ["edibles", "flower", "pre-rolls", "vaporizers"]
DESKTOP = Path.home() / "Desktop"
CSV_BACKUP = DESKTOP / f"nyc_dutchie_pull_{datetime.now(timezone.utc):%Y%m%d}.csv"
HEADLESS = os.environ.get("HEADLESS", "").lower() in ("1", "true", "yes")


# ---------------------------------------------------------------------------
# Extraction — unchanged from the working CSV script.
# ---------------------------------------------------------------------------
def extract_product_info(product_element, category=""):
    try:
        all_text = product_element.inner_text().strip()
        lines = [line.strip() for line in all_text.split("\n") if line.strip()]

        product_name = brand = strain_type = thc = cbd = price = quantity = ""
        product_link = image_url = ""

        if lines:
            product_name = lines[0]

        if len(lines) > 1:
            for line in lines[1:4]:
                if any(x in line for x in ["$", "THC:", "CBD:", "Add", "cart", "Indica", "Sativa", "Hybrid"]):
                    continue
                if len(line) < 50 and not re.search(r"\d+\.?\d*\s*mg", line):
                    brand = line
                    break

        try:
            brand_element = product_element.query_selector('[class*="brand"], [class*="Brand"], [data-testid*="brand"]')
            if brand_element:
                brand_text = brand_element.inner_text().strip()
                if brand_text and len(brand_text) < 50:
                    brand = brand_text
        except Exception:
            pass

        if category != "edibles":
            for line in lines:
                for s in ("Indica", "Sativa", "Hybrid"):
                    if s in line:
                        strain_type = s
                        break

        m = re.search(r"THC[:\s]*([\d.]+)\s*%?", all_text, re.IGNORECASE)
        if m:
            thc = m.group(1)
        m = re.search(r"CBD[:\s]*([\d.]+)\s*%?", all_text, re.IGNORECASE)
        if m:
            cbd = m.group(1)
        m = re.search(r"\$(\d+\.?\d*)", all_text)
        if m:
            price = f"${m.group(1)}"

        quantity_found = False
        quantity_patterns = [
            r"Add\s+([\d.]+\s*(?:g|oz|mg|ml|pc|pcs|pack|ct|count)?)\s+to\s+cart",
            r"\b([\d.]+\s*(?:g|oz|mg|ml|pc|pcs|pack|ct|count))\b",
            r"\b([\d.]+\s*x\s*[\d.]+\s*(?:g|oz|mg|ml)?)\b",
            r"\(([\d.]+\s*(?:g|oz|mg|ml|pc|pcs|pack|ct|count)?)\)",
            r"[-|]\s*([\d.]+\s*(?:g|oz|mg|ml|pc|pcs|pack|ct|count)?)\s*(?:$|[-|])",
            r"\b([\d.]+)\s*each\b",
            r"cart.*?([\d.]+\s*(?:g|oz|mg|ml|pc|pcs)?)",
        ]
        for pattern in quantity_patterns:
            qm = re.search(pattern, all_text, re.IGNORECASE)
            if qm:
                potential = qm.group(1).strip()
                if not re.match(r"^\d+\.?\d*$", potential) or float(re.search(r"[\d.]+", potential).group()) > 1000:
                    if any(u in potential.lower() for u in ("mg", "g", "oz", "ml")):
                        quantity, quantity_found = potential, True
                        break
                elif float(re.search(r"[\d.]+", potential).group()) <= 100:
                    quantity, quantity_found = potential, True
                    break

        if not quantity_found:
            try:
                for elem in product_element.query_selector_all('[class*="quantity"], [class*="Quantity"], [class*="weight"], [class*="Weight"], button'):
                    elem_text = elem.inner_text().strip()
                    for pattern in quantity_patterns[:4]:
                        qm = re.search(pattern, elem_text, re.IGNORECASE)
                        if qm:
                            quantity, quantity_found = qm.group(1).strip(), True
                            break
                    if quantity_found:
                        break
            except Exception:
                pass

        if category == "edibles":
            if thc:
                quantity = f"{thc}mg" if not thc.endswith("mg") else thc
            thc = ""
            if not quantity:
                for pattern in (r"([\d.]+\s*mg)", r"([\d.]+mg\s*(?:THC|CBD)?)", r"Total\s*(?:THC)?\s*[:\s]*([\d.]+\s*mg)"):
                    mm = re.search(pattern, all_text, re.IGNORECASE)
                    if mm:
                        quantity = mm.group(1).strip()
                        break

        link_element = product_element.query_selector('a[href*="/product/"]') or product_element.query_selector("a")
        if link_element:
            href = link_element.get_attribute("href")
            if href:
                product_link = f"https://dutchie.com{href}" if href.startswith("/") else href

        try:
            img = product_element.query_selector("img")
            if img:
                image_url = img.get_attribute("src") or ""
                if not image_url and img.get_attribute("srcset"):
                    image_url = img.get_attribute("srcset").split(",")[0].strip().split(" ")[0]
                if not image_url and img.get_attribute("data-src"):
                    image_url = img.get_attribute("data-src")
        except Exception:
            pass

        return {
            "Product Name": product_name, "Brand": brand, "Strain Type": strain_type,
            "THC %": thc, "CBD %": cbd, "Price": price, "Quantity": quantity,
            "Product URL": product_link, "Image URL": image_url,
        }
    except Exception as exc:
        print(f"  extract error: {exc}")
        return None


def scrape_store(page, store_slug: str) -> list[dict]:
    products = []
    base = f"https://dutchie.com/dispensary/{store_slug}/products"
    for category in CATEGORIES:
        page_num = 1
        while True:
            url = f"{base}/{category}" if page_num == 1 else f"{base}/{category}?page={page_num}"
            try:
                page.goto(url, wait_until="domcontentloaded")
                time.sleep(5)
                for _ in range(5):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(2)
                elements = page.query_selector_all('[data-testid*="product"], .product-card, [class*="Product"]')
                if not elements:
                    break
                count = 0
                for el in elements:
                    data = extract_product_info(el, category)
                    if data and data["Product Name"]:
                        data["Store"] = store_slug
                        data["Category"] = category
                        products.append(data)
                        count += 1
                print(f"    {category} p{page_num}: {count}")
                if count < 10:
                    break
                page_num += 1
                time.sleep(3)
            except Exception as exc:
                print(f"    error {url}: {exc}")
                break
    return products


# ---------------------------------------------------------------------------
# Map scraped rows -> Supabase product rows.
# ---------------------------------------------------------------------------
def _num(x):
    if not x:
        return None
    m = re.search(r"[\d.]+", str(x))
    return float(m.group()) if m else None


def to_row(p: dict) -> dict:
    url = p.get("Product URL") or ""
    m = re.search(r"/product/([^/?#]+)", url)
    external_id = m.group(1) if m else hashlib.md5(
        f"{p.get('Store')}|{p.get('Product Name')}|{p.get('Brand')}|{p.get('Quantity')}".encode()
    ).hexdigest()[:16]
    price = _num(p.get("Price"))
    return {
        "external_id": external_id,
        "name": p.get("Product Name") or None,
        "brand": p.get("Brand") or None,
        "category": p.get("Category") or None,
        "strain_type": p.get("Strain Type") or None,
        "thc_pct": _num(p.get("THC %")),
        "cbd_pct": _num(p.get("CBD %")),
        "variants": [{"weight": p.get("Quantity") or None, "price": price}],
        "price_min": price,
        "url": url or None,
        "image_url": p.get("Image URL") or None,
    }


def save_csv(rows: list[dict]) -> None:
    if not rows:
        return
    fields = ["Store", "Category", "Product Name", "Brand", "Strain Type", "THC %",
              "CBD %", "Price", "Quantity", "Product URL", "Image URL"]
    with open(CSV_BACKUP, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"CSV backup: {CSV_BACKUP}")


def main() -> int:
    supa = sync_mod.Supa()
    if not supa.can_write:
        print("ERROR: set SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard -> "
              "Project Settings -> API -> service_role) so the script can write.")
        return 1

    run_start = datetime.now(timezone.utc).isoformat()
    stores = supa.active_stores()
    print(f"Active stores from Supabase: {len(stores)}")

    all_raw: list[dict] = []
    stores_ok = stores_failed = products_seen = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        page = browser.new_page()
        page.set_default_timeout(60000)
        for i, store in enumerate(stores, 1):
            slug = store["slug"]
            print(f"\n[{i}/{len(stores)}] {slug}")
            try:
                raw = scrape_store(page, slug)
                all_raw.extend(raw)
                # dedup within store by external_id so the upsert batch is clean
                rows = {}
                for r in raw:
                    row = to_row(r)
                    rows[row["external_id"]] = row
                supa.upsert_products(store["id"], list(rows.values()))
                supa.mark_unseen_out_of_stock(store["id"], run_start)
                stores_ok += 1
                products_seen += len(rows)
                print(f"  -> {len(rows)} products upserted")
            except Exception as exc:
                stores_failed += 1
                print(f"  FAILED {slug}: {exc}")
        browser.close()

    save_csv(all_raw)
    supa.log_run(stores_ok, stores_failed, products_seen,
                 notes=f"local run; csv={CSV_BACKUP.name}")
    print(f"\nDone: {stores_ok} ok, {stores_failed} failed, {products_seen} products.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
