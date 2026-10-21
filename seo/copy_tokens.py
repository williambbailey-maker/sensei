#!/usr/bin/env python3
"""Numbers in the editorial copy come from the data, never from the writer.

Copy in seo/data/copy/*.json writes counts and prices as tokens that build.py
fills from the page's own record in seo/data/site.json on every rebuild:

    "about {in_stock|about} products from {brands} brands, from {min_price}"
    -> "about 2,000 products from 245 brands, from $4"

Token syntax: {name} or {name|filter}. Dotted names reach into maps:
{cat.flower}, {brand.Jeeter}, {shop.qube-manhattan}, {hood.Midtown}.

Filters
    (none)  1,999 · prices as $4 or $4.50
    about   rounded for prose: under 10 exact, under 100 to the nearest 5,
            under 1,000 to the nearest 10, else to the nearest 50
            (prices round to the dollar)
    word    one..twelve spelled out, larger numbers as digits

The guard (violations) rejects hand-typed data numbers left in copy: any $
price, any percentage, and any number or number word (two..twelve) followed
within two words by a count noun (products, brands, shops, listings, ...).
Addresses, ages, doses, ratios and brand names are not data counts and pass.

CLI
    python3 seo/copy_tokens.py vars <dispensary|neighborhood|brand|category> <key>
    python3 seo/copy_tokens.py check            # every copy file
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = json.loads((ROOT / "data" / "site.json").read_text())


def slugify(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-") or "x"


PRICE_VARS = {"min_price", "avg_price", "shop_min"}


def _rec(kind, key):
    if kind == "dispensary":
        return next((d for d in SITE["dispensaries"] if d["slug"] == key), None)
    if kind == "neighborhood":
        return next((n for n in SITE["neighborhoods"] if slugify(n["neighborhood"]) == key), None)
    if kind == "brand":
        return next((b for b in SITE["brands"] if slugify(b["brand"]) == key), None)
    if kind == "category":
        return next((c for c in SITE["categories"] if c["category"] == key), None)
    raise ValueError(kind)


def page_vars(kind, key):
    """Every token a page of this kind may use, with its current value."""
    r = _rec(kind, key)
    if r is None:
        return None
    # City-wide figures from the database's site_stats() (live shops only).
    st = SITE.get("stats") or {}
    v = {"city.shops": st.get("shops", len(SITE["dispensaries"])),
         "city.hoods": st.get("neighborhoods", len(SITE["neighborhoods"])),
         "city.in_stock": st.get("in_stock", sum(c["in_stock"] for c in SITE["categories"]))}
    for c in SITE["categories"]:
        v[f"city.cat.{c['category']}"] = c["in_stock"]
        v[f"city.cat_min.{c['category']}"] = c["min_price"]
    if kind == "dispensary":
        v.update(in_stock=r["in_stock"], brands=r["brands"], min_price=r["min_price"])
        for c, n in (r.get("categories") or {}).items():
            v[f"cat.{c}"] = n
        for b in r.get("top_brands") or []:
            v[f"brand.{b['brand']}"] = b["n"]
        hood = [d for d in SITE["dispensaries"] if d.get("neighborhood") == r.get("neighborhood")]
        v["hood_shops"] = len(hood)
        v["hood_rank"] = sorted(hood, key=lambda d: -d["in_stock"]).index(r) + 1
        v["city_rank"] = sorted(SITE["dispensaries"], key=lambda d: -d["in_stock"]).index(r) + 1
    elif kind == "neighborhood":
        v.update(shops=r["stores"], in_stock=r["in_stock"], categories=len(r.get("categories") or {}))
        for c, n in (r.get("categories") or {}).items():
            v[f"cat.{c}"] = n
        for s in r.get("stores_list") or []:
            v[f"shop.{s['slug']}"] = s["in_stock"]
        prices = [p["price_min"] for p in (r.get("featured") or []) if p.get("price_min")]
        if prices:
            v["min_price"] = min(prices)
    elif kind == "brand":
        v.update(shops=r["stores"], in_stock=r["in_stock"], min_price=r["min_price"], avg_price=r["avg_price"])
        for c, n in (r.get("categories") or {}).items():
            v[f"cat.{c}"] = n
        for s in r.get("stores_list") or []:
            v[f"shop.{s['slug']}"] = s["n"]
            if s.get("min_price") is not None:
                v[f"shop_min.{s['slug']}"] = s["min_price"]
    elif kind == "category":
        v.update(in_stock=r["in_stock"], shops=r["stores"], brands=r["brands"], min_price=r["min_price"])
        for b in r.get("top_brands") or []:
            v[f"brand.{b['brand']}"] = b["n"]
        for h in r.get("neighborhoods") or []:
            v[f"hood.{h['neighborhood']}"] = h["n"]
    return v


WORDS = "zero one two three four five six seven eight nine ten eleven twelve".split()


def _is_price(name):
    return name.split(".")[0] in PRICE_VARS or name.startswith("city.cat_min.")


def _fmt(name, x, flt):
    price = _is_price(name)
    if flt == "about":
        if price:
            x = round(x)
        elif x >= 1000:
            x = int(round(x / 50.0) * 50)
        elif x >= 100:
            x = int(round(x / 10.0) * 10)
        elif x >= 10:
            x = int(round(x / 5.0) * 5)
    if flt == "word" and not price and float(x).is_integer() and 0 <= x <= 12:
        return WORDS[int(x)]
    if price:
        x = round(float(x), 2)
        return f"${int(x)}" if x == int(x) else f"${x:.2f}"
    return f"{int(round(x)):,}"


TOKEN_RE = re.compile(r"\{([a-z_]+(?:\.[^{}|]+)?)(?:\|([a-z]+))?\}")


def render(text, v, where=""):
    def sub(m):
        name, flt = m.group(1), m.group(2)
        if name not in v:
            raise SystemExit(f"unknown copy token {{{name}}} in {where}")
        if flt not in (None, "about", "word"):
            raise SystemExit(f"unknown filter |{flt} in {where}")
        return _fmt(name, v[name], flt)
    out = TOKEN_RE.sub(sub, text)
    # Numbers change, so "a" vs "an" can't be written by hand: "an 81-item",
    # "an 8", "an 11", "an 18,000" (spoken with a vowel sound).
    out = re.sub(r"\b([Aa]) (?=(?:8[\d,]*|11|18|11,\d{3}|18,\d{3})\b)",
                 lambda m: ("An" if m.group(1) == "A" else "an") + " ", out)
    if re.search(r"\{[^{}]*\}", out):
        raise SystemExit(f"malformed token left in {where}: {out[:120]}")
    return out


COUNT_NOUNS = (r"products?|items?|brands?|listings?|options?|skus?|shops?|stores?|dispensar(?:y|ies)|"
               r"menus?|lines?|strains?|categories|edibles?|vapes?|vaporizers?|carts?|cartridges?|pre-?rolls?|"
               r"flowers?|concentrates?|tinctures?|topicals?|gummies|eighths?|beverages?|drinks?|neighborhoods?|"
               r"locations?|choices|selections?|varieties|kinds|types|offerings?|picks?|jars?|pens?|packs?")
NUM_WORDS = r"two|three|four|five|six|seven|eight|nine|ten|eleven|twelve"
_GUARD = [
    re.compile(r"\$\s?\d"),
    re.compile(r"\b\d+(?:\.\d+)?\s?%"),
    re.compile(rf"(?<![\w.:/-])\d[\d,]*(?:\.\d+)?(?:-item|-strong|-shop)?\s+(?:[\w-]+\s+){{0,2}}?(?:{COUNT_NOUNS})\b", re.I),
    re.compile(rf"\b(?:{NUM_WORDS})\s+(?:[\w-]+\s+){{0,1}}?(?:shops?|stores?|dispensar(?:y|ies)|brands?|locations?)\b", re.I),
]
# Not data counts: doses, sizes, ratios, ages and addresses.
_OK = re.compile(r"\b\d+(?:\.\d+)?\s?(?:mg|g|oz|ml|fl\.? oz)\b|\b\d+:\d+\b|\b21\+?|\b\d+(?:st|nd|rd|th)\b", re.I)


def violations(text):
    """Hand-typed data numbers left in raw copy (tokens are ignored)."""
    raw = TOKEN_RE.sub("TOKEN", text)
    raw = _OK.sub("OK", raw)
    hits = []
    for g in _GUARD:
        hits += [m.group(0) for m in g.finditer(raw)]
    return hits


def _strings(c):
    for i, p in enumerate(c.get("intro") or []):
        yield f"intro[{i}]", p
    for i, k in enumerate(c.get("know") or []):
        yield f"know[{i}]", k
    for i, q in enumerate(c.get("faq") or []):
        yield f"faq[{i}].q", q.get("q", "")
        yield f"faq[{i}].a", q.get("a", "")


KIND_OF_FILE = {"dispensaries": "dispensary", "neighborhoods": "neighborhood", "brands": "brand", "categories": "category"}


def check_files(paths):
    bad = 0
    for path in paths:
        kind = KIND_OF_FILE[Path(path).stem.split("-")[0]]
        data = json.loads(Path(path).read_text())
        for key, c in data.items():
            if key.startswith("_"):
                continue
            v = page_vars(kind, key)
            for where, s in _strings(c):
                loc = f"{Path(path).name} {key} {where}"
                hits = violations(s)
                if hits:
                    bad += 1
                    print(f"NUMBER  {loc}: {hits}")
                if v is not None:
                    try:
                        render(s, v, loc)
                    except SystemExit as e:
                        bad += 1
                        print(f"TOKEN   {e}")
    return bad


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "vars":
        v = page_vars(sys.argv[2], sys.argv[3])
        if v is None:
            raise SystemExit("no such page")
        for k, x in sorted(v.items()):
            print(f"{{{k}}} = {_fmt(k, x, None)}   |about = {_fmt(k, x, 'about')}")
    elif len(sys.argv) >= 2 and sys.argv[1] == "check":
        files = sys.argv[2:] or sorted(str(p) for p in (ROOT / "data" / "copy").glob("*.json"))
        n = check_files(files)
        print(f"{n} problem(s)" if n else "copy clean: no hand-typed data numbers, all tokens resolve")
        sys.exit(1 if n else 0)
    else:
        print(__doc__)
