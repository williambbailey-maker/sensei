#!/usr/bin/env python3
"""
Sensei SEO site generator — Phase 1.

Builds the deployable static SEO site from seo/data/site.json (a live Supabase
snapshot) into seo/dist/:

  /                              home hub
  /dispensaries/<slug>/          67  (LocalBusiness + Breadcrumb JSON-LD)
  /neighborhoods/<slug>/         18  (ItemList + Breadcrumb)
  /brands/<slug>/                15  (ItemList + Breadcrumb)
  /nyc/<category>/                7  (ItemList + Breadcrumb)
  /sitemap.xml  /robots.txt

Mobile-first, Sensei dark identity (cyber yellow on onyx, Inter). Each page
leads with a big card whose primary action is a Sensei app deep-link, then a
curated set — never a dump — and cross-links to the other page types.
Regenerate the snapshot with pull from an unblocked network; then: python build.py
"""

import json
import os
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
SITE = json.loads((ROOT / "data" / "site.json").read_text())
SITE_URL = "https://sensei.nyc"
APP = "https://sensei.nyc"  # the Sensei web app (SPA at the domain root)

# PostHog — baked in at build time. The project key is public (write-only), so
# it's a default fallback like the app's; env overrides it, and setting it to a
# value starting "__" makes the inline script no-op. See ANALYTICS-EVENTS.md.
POSTHOG_KEY = os.environ.get("SENSEI_POSTHOG_KEY", "phc_rqqTjemCGcjixkB3oiNQgB2L9w4yRGyZcYK3iP4mEcXX")
POSTHOG_HOST = os.environ.get("SENSEI_POSTHOG_HOST", "https://us.i.posthog.com")

CAT_LABEL = {"pre-rolls": "Pre-Rolls", "vaporizers": "Vapes", "edibles": "Edibles",
             "flower": "Flower", "concentrates": "Concentrates", "tinctures": "Tinctures",
             "topicals": "Topicals"}
def clabel(c): return CAT_LABEL.get(c, (c or "").title())

def slugify(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-") or "x"

def money(n):
    if n is None or not (float(n) > 0):
        return "—"
    n = round(float(n), 2)
    return f"${int(n)}" if n == int(n) else f"${n:.2f}"

def esc(s):
    return (str(s) if s is not None else "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def thc_ok(p):
    c = p.get("category") or ""
    t = p.get("thc_pct")
    return c in ("flower", "pre-rolls", "vaporizers", "concentrates") and isinstance(t, (int, float)) and 0 < t <= 100

# known page slugs for internal linking
HOOD_SLUGS = {slugify(n["neighborhood"]): n["neighborhood"] for n in SITE["neighborhoods"]}
BRAND_SLUGS = {slugify(b["brand"]): b["brand"] for b in SITE["brands"]}
STORE_SLUGS = {d["slug"] for d in SITE["dispensaries"]}
CAT_SLUGS = {c["category"] for c in SITE["categories"]}

# app deep links (primary Sensei action)
def app_store(slug): return f"{APP}/?store={quote(slug)}"
def app_brand(b): return f"{APP}/?brand={quote(b)}"
def app_hood(h, cat=None): return f"{APP}/?neighborhood={quote(h)}" + (f"&category={quote(cat)}" if cat else "")
def app_cat(c, extra=""): return f"{APP}/?category={quote(c)}" + (f"&{extra}" if extra else "")

# ---------- shared chrome ----------
CSS = """
:root{--yellow:#FDE047;--onyx:#0A0A0A;--charcoal:#171717;--void:#262626;--ink:#fff;--mut:#A3A3A3;
--line:rgba(255,255,255,.14);--glass:rgba(255,255,255,.05);--gl:rgba(255,255,255,.12);
--font:'Inter',ui-sans-serif,system-ui,-apple-system,Arial,sans-serif;}
*{box-sizing:border-box}
html{background:var(--onyx)}
body{margin:0;background:var(--onyx);color:var(--ink);font-family:var(--font);line-height:1.45;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.shell{max-width:420px;margin:0 auto}
.hd{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid rgba(255,255,255,.1);
 position:sticky;top:0;background:rgba(10,10,10,.82);backdrop-filter:blur(14px);z-index:5}
.wm{font-weight:900;letter-spacing:-.04em;font-size:26px;color:var(--yellow);line-height:1}
.hd .est{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--mut);
 border:1px solid var(--line);border-radius:999px;padding:5px 11px}
.wrap{padding:18px}
.crumb{color:var(--mut);font-size:11px;font-weight:600;margin:0 0 10px}
.crumb a{color:var(--mut)}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--yellow);margin:0}
h1{font-size:33px;font-weight:900;letter-spacing:-.035em;line-height:1.02;margin:8px 0 0}
.lede{color:var(--mut);font-size:14px;margin:12px 0 0;max-width:60ch}
.prose{margin-top:14px;padding:12px 14px;border:1px dashed var(--line);border-radius:14px;color:#6a6a6a;font-size:12.5px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:20px}
.stat{background:var(--glass);border:1px solid var(--gl);border-radius:18px;padding:13px 14px}
.stat .n{font-size:22px;font-weight:900;letter-spacing:-.02em;color:var(--yellow)}
.stat .k{display:block;margin-top:2px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
.hero{background:var(--yellow);color:var(--onyx);border-radius:30px;border-bottom-right-radius:60px;padding:22px 20px;margin-top:22px}
.hero .bn{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(10,10,10,.55)}
.hero h2{font-size:27px;font-weight:900;letter-spacing:-.03em;line-height:1.02;margin:6px 0 8px}
.hero p{font-size:14px;color:rgba(10,10,10,.8);margin:0 0 16px;font-weight:500}
.hero p b{color:var(--onyx);font-weight:800}
.cta{display:inline-block;background:var(--onyx);color:var(--yellow);font-weight:800;font-size:13px;padding:13px 18px;border-radius:999px}
.sh{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--mut);margin:30px 0 10px}
.card{display:flex;gap:13px;align-items:center;background:var(--glass);border:1px solid var(--gl);border-radius:20px;padding:11px 13px;margin-bottom:10px}
.tile{width:50px;height:50px;border-radius:13px;flex:none;display:grid;place-items:center;font-size:21px;background:var(--void);border:1px solid var(--gl);overflow:hidden}
.tile img{width:100%;height:100%;object-fit:cover}
.card .l{flex:1;min-width:0}
.card .nm{font-size:14px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .mt{color:var(--mut);font-size:12px;margin-top:3px}
.tag{display:inline-block;margin-top:6px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
 color:var(--yellow);background:rgba(253,224,71,.12);border:1px solid rgba(253,224,71,.35);padding:3px 8px;border-radius:999px}
.card .r{text-align:right;white-space:nowrap}
.card .pr{font-weight:900;font-size:15px}
.card .pg{color:var(--mut);font-size:11px;margin-top:1px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{font-size:12px;font-weight:700;padding:8px 13px;border-radius:999px;background:var(--glass);border:1px solid var(--gl);color:var(--ink)}
.chip .c{color:var(--mut);font-variant-numeric:tabular-nums}
.chip.on{background:var(--yellow);color:var(--onyx);border-color:var(--yellow)}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 2px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.row .snm{font-size:15px;font-weight:700}
.row .sd{color:var(--mut);font-size:12px;margin-top:2px}
.row .sn{color:var(--mut);font-size:11px;white-space:nowrap;text-align:right}
.row .sn b{display:block;color:var(--yellow);font-size:16px}
.bars{display:flex;flex-direction:column;gap:8px}
.bar{display:flex;align-items:center;gap:10px}
.bar .bk{width:92px;font-size:12px;font-weight:600;flex:none}
.bar .bt{flex:1;height:8px;background:var(--void);border-radius:999px;overflow:hidden;min-width:0}
.bar .bf{height:100%;background:var(--yellow)}
.bar .bn{width:46px;text-align:right;font-size:11px;color:var(--mut);flex:none;font-variant-numeric:tabular-nums}
.xgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.xl{display:block;background:var(--glass);border:1px solid var(--gl);border-radius:16px;padding:13px 14px}
.xl .xk{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--yellow);font-weight:800}
.xl .xv{font-size:13px;font-weight:700;margin-top:4px}
.xl .xd{font-size:11px;color:var(--mut);margin-top:2px}
.ft{border-top:1px solid var(--line);margin-top:40px;padding:26px 18px 40px;color:#6a6a6a;font-size:11px}
.ft .wm{font-size:20px;margin-bottom:10px;display:inline-block}
.back{display:inline-block;color:var(--mut);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin:0 0 14px}
.back:before{content:"← "}
#ag{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:24px;text-align:center;
 background:rgba(10,10,10,.93);backdrop-filter:blur(10px)}
#ag .box{max-width:330px}#ag h2{margin:10px 0 0;font-size:22px}#ag p{color:var(--mut);font-size:13px;margin:10px 0 20px}
#ag .r{display:flex;flex-direction:column;gap:10px}
#ag button{cursor:pointer;font-family:inherit;border:0;border-radius:999px;padding:13px;font-weight:800;font-size:14px}
#ag .y{background:var(--yellow);color:var(--onyx)}#ag .n{background:transparent;color:var(--mut);border:1px solid var(--line)}
.ag-ok #ag{display:none}
"""

AGE_GATE = """
<div id="ag" role="dialog" aria-label="Age check" aria-modal="true"><div class="box">
<span class="wm" style="font-size:26px;color:var(--yellow);font-weight:900">sensei</span>
<h2>Are you 21 or older?</h2><p>You must be of legal age to view licensed cannabis products in New York State.</p>
<div class="r"><button class="y" id="agy" type="button">Yes, I'm 21+</button>
<button class="n" type="button" onclick="location.href='https://www.google.com'">No</button></div></div></div>
<script>(function(){var K='sensei_age_ok';try{if(sessionStorage.getItem(K)==='1')document.documentElement.classList.add('ag-ok')}catch(e){}
var y=document.getElementById('agy');if(y)y.onclick=function(){document.documentElement.classList.add('ag-ok');try{sessionStorage.setItem(K,'1')}catch(e){}}})();</script>
<noscript><style>#ag{display:none}</style></noscript>
"""

def pkey(brand, name):
    # Canonical product key — same slug the app uses (analytics.ts productKey).
    return slugify(f"{brand or ''} {name or ''}")

# Inline analytics for the static pages. Every event carries the six mandated
# properties via registered super-properties (brand/product_key default null,
# page_type/dispensary/neighborhood/source set per page). Events fired here:
#   $pageview (auto) · brand_view (brand pages) · product_impression (cards in
#   view) · chip_tap (chips/bars) · menu_click (the "open in Sensei" CTAs).
# product_view/compare_view/save/signup have no surface on these pages — they
# live in the app. See reports/README.md for the full mapping.
def analytics_js(page_type, ctx):
    cfg = {"key": POSTHOG_KEY, "host": POSTHOG_HOST, "page_type": page_type}
    for k, v in (ctx or {}).items():
        if v:
            cfg[k] = v
    return """<script>
(function(){var CFG=%s;if(!CFG.key||CFG.key.indexOf('__')===0)return;
function src(){try{var q=new URLSearchParams(location.search),s=(q.get('src')||'').toLowerCase();
if(s.indexOf('qr')===0)return'qr';var m=(q.get('utm_medium')||'').toLowerCase(),u=(q.get('utm_source')||'').toLowerCase();
if(['cpc','ppc','paid','paidsearch','display'].indexOf(m)>=0||/ad/.test(u))return'ad';
var r=document.referrer;if(!r)return'direct';var h=new URL(r).hostname.replace(/^www\\./,'');
if(h===location.hostname)return'direct';
if(/(^|\\.)(google|bing|duckduckgo|yahoo|ecosia|brave)\\./.test(h)||h.indexOf('search')>=0)return'organic';
if(/(instagram|facebook|t\\.co|twitter|x\\.com|reddit|tiktok|linkedin|youtube|pinterest|threads)/.test(h))return'social';
return'direct';}catch(e){return'direct';}}
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister getFeatureFlag isFeatureEnabled".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init(CFG.key,{api_host:CFG.host,capture_pageview:true,autocapture:false,person_profiles:'identified_only'});
var base={brand:CFG.brand||null,product_key:null,dispensary:CFG.dispensary||null,neighborhood:CFG.neighborhood||null,page_type:CFG.page_type,source:src()};
if(CFG.category)base.category=CFG.category;posthog.register(base);
if(CFG.page_type==='brand')posthog.capture('brand_view',{});
function cp(el){return{brand:el.getAttribute('data-brand')||base.brand,product_key:el.getAttribute('data-product-key')||null,category:el.getAttribute('data-category')||CFG.category||null};}
try{var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){posthog.capture('product_impression',cp(x.target));io.unobserve(x.target);}});},{threshold:0.5});
document.querySelectorAll('.card[data-ev="product"]').forEach(function(el){io.observe(el);});}catch(e){}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-ev]');if(!a)return;var ev=a.getAttribute('data-ev');
if(ev==='chip')posthog.capture('chip_tap',{brand:a.getAttribute('data-brand')||null,neighborhood:a.getAttribute('data-hood')||null,category:a.getAttribute('data-cat')||null,label:(a.textContent||'').trim()});
else if(ev==='menu')posthog.capture('menu_click',{brand:a.getAttribute('data-brand')||base.brand,dispensary:a.getAttribute('data-dispensary')||base.dispensary,url:a.getAttribute('href')||null});},true);
})();
</script>""" % json.dumps(cfg)

def page(title, desc, path, jsonld, body, page_type=None, ctx=None):
    canon = SITE_URL + path
    ld = "".join(f'<script type="application/ld+json">{json.dumps(j)}</script>' for j in jsonld)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0A0A0A">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{canon}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>{CSS}</style>{ld}</head><body><div class="shell">
<header class="hd"><a class="wm" href="/">sensei</a><span class="est">21+ · NYC</span></header>
<main class="wrap">{body}</main>
<footer class="ft"><a class="wm" href="/">sensei</a><br>Every licensed NYC dispensary menu, one place. Prices refresh from live menus. Sensei is an independent guide — order on the dispensary's own site. Adults 21+ only.</footer>
</div>{AGE_GATE}{analytics_js(page_type, ctx)}</body></html>
"""

def breadcrumb(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n,
                                 "item": SITE_URL + u} for i, (n, u) in enumerate(items)]}

def itemlist(name, names):
    return {"@context": "https://schema.org", "@type": "ItemList", "name": name,
            "numberOfItems": len(names),
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n} for i, n in enumerate(names)]}

def pcard(p):
    img = f'<img src="{esc(p.get("image_url"))}" alt="" loading="lazy">' if p.get("image_url") else ("💎" if False else "🌿")
    tags = []
    if p.get("strain_type"): tags.append(f'<span class="tag">{esc(p["strain_type"])}</span>')
    if thc_ok(p): tags.append(f'<span class="tag">{round(p["thc_pct"])}% THC</span>')
    if p.get("category"): tags.append(f'<span class="tag">{esc(clabel(p["category"]))}</span>')
    name = p.get("name") or ""
    brand = f'<div class="mt">{esc(p["brand"])}</div>' if p.get("brand") else ""
    attrs = (f'data-ev="product" data-brand="{esc(p.get("brand") or "")}" '
             f'data-product-key="{esc(pkey(p.get("brand"), name))}" '
             f'data-category="{esc(p.get("category") or "")}"')
    return (f'<div class="card" {attrs}><span class="tile">{img}</span><div class="l">'
            f'<div class="nm">{esc(name)}</div>{brand}<div>{"".join(tags[:2])}</div></div>'
            f'<div class="r"><div class="pr">{money(p.get("price_min"))}</div><div class="pg">from</div></div></div>')

def write(path, html):
    out = DIST / path.strip("/") / "index.html" if path != "/" else DIST / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)

def catbars(cats, link_fn):
    if not cats: return ""
    mx = max(cats.values())
    rows = ""
    for cat, n in sorted(cats.items(), key=lambda kv: -kv[1]):
        href = link_fn(cat)
        inner = (f'<span class="bk">{esc(clabel(cat))}</span>'
                 f'<span class="bt"><span class="bf" style="width:{round(n/mx*100)}%"></span></span>'
                 f'<span class="bn">{n}</span>')
        rows += f'<a class="bar" href="{href}" data-ev="chip" data-cat="{esc(cat)}">{inner}</a>'
    return f'<div class="bars">{rows}</div>'

# ---------- page builders ----------
def build_dispensary(d):
    path = f"/dispensaries/{d['slug']}/"
    hoodslug = slugify(d["neighborhood"]) if d.get("neighborhood") else None
    title = f"{d['name']} — Cannabis Menu, Prices & Deals | Sensei"
    desc = (f"{d['name']} in {d.get('neighborhood') or d.get('borough') or 'NYC'}: "
            f"{d['in_stock']} products in stock from {d['brands']} brands, from {money(d['min_price'])}. "
            f"Compare prices across NYC dispensaries on Sensei.")
    street = (d.get("address") or "").split(",")
    addr = {"@type": "PostalAddress", "streetAddress": street[0].strip() if street else None,
            "addressLocality": "New York", "addressRegion": "NY", "addressCountry": "US"}
    ld = [{"@context": "https://schema.org", "@type": ["Store", "LocalBusiness"], "name": d["name"],
           "url": SITE_URL + path, "image": (d["featured"] or [{}])[0].get("image_url"),
           "address": addr, "geo": {"@type": "GeoCoordinates", "latitude": d.get("lat"), "longitude": d.get("lng")},
           "areaServed": f"{d.get('borough') or 'New York'}, NY"},
          breadcrumb([("Sensei", "/"), ("Dispensaries", "/dispensaries/"),
                      (d["name"], path)])]
    hood_link = f'<a href="/neighborhoods/{hoodslug}/">{esc(d["neighborhood"])}</a>' if hoodslug in HOOD_SLUGS else esc(d.get("neighborhood") or "")
    # brand chips -> brand pages where they exist
    bchips = ""
    for b in (d.get("top_brands") or []):
        s = slugify(b["brand"])
        href = f"/brands/{s}/" if s in BRAND_SLUGS else app_brand(b["brand"])
        bchips += f'<a class="chip" href="{href}" data-ev="chip" data-brand="{esc(b["brand"])}">{esc(b["brand"])} <span class="c">{b["n"]}</span></a>'
    cats = catbars(d.get("categories") or {},
                   lambda c: (f"/nyc/{c}/" if c in CAT_SLUGS else app_cat(c, f"store={d['slug']}")))
    feat = "".join(pcard(p) for p in (d.get("featured") or [])[:4])
    body = f"""
<p class="crumb"><a href="/">Sensei</a> › {hood_link} › Dispensary</p>
<p class="eyebrow">{esc(d.get('neighborhood') or '')} · {esc(d.get('borough') or '')}</p>
<h1>{esc(d['name'])}</h1>
<div class="prose">{{prose}} — a line on what this shop is known for.</div>
<div class="stats"><div class="stat"><span class="n">{d['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{d['brands']}</span><span class="k">Brands</span></div>
<div class="stat"><span class="n">{money(d['min_price'])}</span><span class="k">From</span></div></div>
<div class="hero"><div class="bn">{esc(d.get('neighborhood') or 'NYC')} · live menu</div>
<h2>Shop {esc(d['name'])} on Sensei</h2>
<p>Compare every item here against nearby NYC shops — then order where it's cheapest.</p>
<a class="cta" href="{app_store(d['slug'])}" data-ev="menu" data-dispensary="{esc(d['name'])}">Browse {esc(d['name'])} →</a></div>
<div class="sh">What's on the shelf</div>{cats}
<div class="sh">Top brands here</div><div class="chips">{bchips}</div>
<div class="sh">Featured right now</div>{feat}
<div class="sh">Explore Sensei</div>{crosslinks(exclude_store=d['slug'], hood=d.get('neighborhood'))}
"""
    write(path, page(title, desc, path, ld, body, "dispensary",
                     {"dispensary": d["name"], "neighborhood": d.get("neighborhood")}))
    return path

def build_neighborhood(n):
    slug = slugify(n["neighborhood"]); path = f"/neighborhoods/{slug}/"
    title = f"Weed in {n['neighborhood']} — {n['stores']} Dispensaries, Menus & Prices | Sensei"
    desc = (f"Compare {n['stores']} licensed cannabis dispensaries in {n['neighborhood']}, {n['borough']}: "
            f"{n['in_stock']} products in stock. Filter {n['neighborhood']} by category and price on Sensei.")
    ld = [itemlist(f"Dispensaries in {n['neighborhood']}", [s["name"] for s in (n.get("stores_list") or [])]),
          breadcrumb([("Sensei", "/"), ("Neighborhoods", "/neighborhoods/"), (n["neighborhood"], path)])]
    cats = catbars(n.get("categories") or {},
                   lambda c: (f"/nyc/{c}/" if c in CAT_SLUGS else app_hood(n["neighborhood"], c)))
    stores = ""
    for s in (n.get("stores_list") or []):
        href = f"/dispensaries/{s['slug']}/" if s["slug"] in STORE_SLUGS else app_store(s["slug"])
        stores += (f'<a class="row" href="{href}"><div class="l"><div class="snm">{esc(s["name"])}</div>'
                   f'<div class="sd">{esc(s.get("address") or "")}</div></div>'
                   f'<div class="sn"><b>{s["in_stock"]}</b>in stock</div></a>')
    feat = "".join(pcard(p) for p in (n.get("featured") or [])[:4])
    body = f"""
<p class="crumb"><a href="/">Sensei</a> › {esc(n['borough'])} › Neighborhood</p>
<p class="eyebrow">{esc(n['borough'])}</p>
<h1>Weed in {esc(n['neighborhood'])}</h1>
<div class="prose">{{prose}} — the lay of the land for buying in {esc(n['neighborhood'])}.</div>
<div class="stats"><div class="stat"><span class="n">{n['stores']}</span><span class="k">Shops</span></div>
<div class="stat"><span class="n">{n['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{len(n.get('categories') or {})}</span><span class="k">Categories</span></div></div>
<div class="hero"><div class="bn">{n['stores']} shops · one search</div>
<h2>Shop all of {esc(n['neighborhood'])} on Sensei</h2>
<p>Every {esc(n['neighborhood'])} menu in one place, sorted by price and distance.</p>
<a class="cta" href="{app_hood(n['neighborhood'])}" data-ev="menu">Shop {esc(n['neighborhood'])} →</a></div>
<div class="sh">Filter {esc(n['neighborhood'])} by category</div>{cats}
<div class="sh">Dispensaries in {esc(n['neighborhood'])}</div>{stores}
<div class="sh">Popular right now</div>{feat}
<div class="sh">Explore Sensei</div>{crosslinks(exclude_hood=slug)}
"""
    write(path, page(title, desc, path, ld, body, "neighborhood",
                     {"neighborhood": n["neighborhood"]}))
    return path

def build_brand(b):
    slug = slugify(b["brand"]); path = f"/brands/{slug}/"
    title = f"{b['brand']} in NYC — {b['stores']} Dispensaries Stocking It | Sensei"
    desc = (f"Find {b['brand']} at {b['stores']} NYC dispensaries: {b['in_stock']} products from {money(b['min_price'])}. "
            f"See every store stocking {b['brand']} and compare prices on Sensei.")
    ld = [itemlist(f"NYC dispensaries stocking {b['brand']}", [s["name"] for s in (b.get("stores_list") or [])]),
          breadcrumb([("Sensei", "/"), ("Brands", "/brands/"), (b["brand"], path)])]
    cchips = "".join(f'<span class="chip">{esc(clabel(c))} <span class="c">{n}</span></span>'
                     for c, n in sorted((b.get("categories") or {}).items(), key=lambda kv: -kv[1]))
    stores = ""
    for s in (b.get("stores_list") or []):
        href = f"/dispensaries/{s['slug']}/" if s["slug"] in STORE_SLUGS else app_store(s["slug"])
        hs = slugify(s.get("neighborhood") or "")
        place = (f'<a href="/neighborhoods/{hs}/">{esc(s.get("neighborhood"))}</a>' if hs in HOOD_SLUGS else esc(s.get("neighborhood") or ""))
        stores += (f'<a class="row" href="{href}"><div class="l"><div class="snm">{esc(s["name"])}</div>'
                   f'<div class="sd">{place}, {esc(s.get("borough") or "")}</div></div>'
                   f'<div class="sn"><b>{money(s.get("min_price"))}</b>from · {s["n"]} items</div></a>')
    feat = "".join(pcard({**p, "brand": b["brand"]}) for p in (b.get("featured") or [])[:4])
    body = f"""
<p class="crumb"><a href="/">Sensei</a> › Brands › {esc(b['brand'])}</p>
<p class="eyebrow">Brand</p>
<h1>{esc(b['brand'])} in NYC</h1>
<div class="prose">{{prose}} — who {esc(b['brand'])} is and what to expect.</div>
<div class="stats"><div class="stat"><span class="n">{b['stores']}</span><span class="k">Stores stock it</span></div>
<div class="stat"><span class="n">{b['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{money(b['min_price'])}</span><span class="k">From</span></div></div>
<div class="hero"><div class="bn">Carried at {b['stores']} shops</div>
<h2>See every store stocking {esc(b['brand'])}</h2>
<p>Compare {esc(b['brand'])} prices across all {b['stores']} NYC shops on Sensei.</p>
<a class="cta" href="{app_brand(b['brand'])}" data-ev="menu" data-brand="{esc(b['brand'])}">Find {esc(b['brand'])} nearby →</a></div>
<div class="sh">What {esc(b['brand'])} makes</div><div class="chips">{cchips}</div>
<div class="sh">Stores carrying {esc(b['brand'])}</div>{stores}
<div class="sh">Popular {esc(b['brand'])} products</div>{feat}
<div class="sh">Explore Sensei</div>{crosslinks(exclude_brand=slug)}
"""
    write(path, page(title, desc, path, ld, body, "brand", {"brand": b["brand"]}))
    return path

def build_category(c):
    cat = c["category"]; path = f"/nyc/{cat}/"; label = clabel(cat)
    title = f"{label} in NYC — {c['in_stock']} in Stock from {money(c['min_price'])} | Sensei"
    desc = (f"Compare {label.lower()} across {c['stores']} NYC dispensaries: {c['in_stock']} in stock "
            f"from {c['brands']} brands, starting at {money(c['min_price'])}. Filter by price and neighborhood on Sensei.")
    ld = [itemlist(f"{label} in New York City", [((p.get('brand') or '') + ' ' + (p.get('name') or '')).strip() for p in (c.get("featured") or [])]),
          breadcrumb([("Sensei", "/"), ("NYC", "/nyc/"), (label, path)])]
    bchips = ""
    for x in (c.get("top_brands") or []):
        s = slugify(x["brand"]); href = f"/brands/{s}/" if s in BRAND_SLUGS else app_brand(x["brand"])
        bchips += f'<a class="chip" href="{href}" data-ev="chip" data-brand="{esc(x["brand"])}">{esc(x["brand"])} <span class="c">{x["n"]}</span></a>'
    hchips = ""
    for h in (c.get("neighborhoods") or []):
        s = slugify(h["neighborhood"]); href = f"/neighborhoods/{s}/" if s in HOOD_SLUGS else app_hood(h["neighborhood"], cat)
        hchips += f'<a class="chip" href="{href}" data-ev="chip" data-hood="{esc(h["neighborhood"])}">{esc(h["neighborhood"])} <span class="c">{h["n"]}</span></a>'
    feat = "".join(pcard({**p, "category": cat}) for p in (c.get("featured") or [])[:6])
    body = f"""
<p class="crumb"><a href="/">Sensei</a> › NYC › {esc(label)}</p>
<p class="eyebrow">New York City</p>
<h1>{esc(label)} in NYC</h1>
<div class="prose">{{prose}} — how to shop {esc(label.lower())} across the city.</div>
<div class="stats"><div class="stat"><span class="n">{c['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{c['stores']}</span><span class="k">Dispensaries</span></div>
<div class="stat"><span class="n">{money(c['min_price'])}</span><span class="k">From</span></div></div>
<div class="hero"><div class="bn">{c['brands']} brands · {c['stores']} shops</div>
<h2>Find the best {esc(label.lower())} near you</h2>
<p>Every NYC {esc(label.lower())} listing, ranked by price and distance on Sensei.</p>
<a class="cta" href="{app_cat(cat)}" data-ev="menu" data-cat="{esc(cat)}">Browse {esc(label.lower())} →</a></div>
<div class="sh">Top {esc(label.lower())} brands</div><div class="chips">{bchips}</div>
<div class="sh">Where it's stocked</div><div class="chips">{hchips}</div>
<div class="sh">Featured {esc(label.lower())}</div>{feat}
<div class="sh">Explore Sensei</div>{crosslinks(exclude_cat=cat)}
"""
    write(path, page(title, desc, path, ld, body, "category", {"category": cat}))
    return path

# representative cross-links to the other page types (connected graph for crawl)
TOP_HOODS = sorted(SITE["neighborhoods"], key=lambda n: -n["in_stock"])
TOP_BRANDS = SITE["brands"]
TOP_DISP = sorted(SITE["dispensaries"], key=lambda d: -d["in_stock"])
def crosslinks(exclude_store=None, exclude_hood=None, exclude_brand=None, exclude_cat=None, hood=None):
    cards = []
    d = next((x for x in TOP_DISP if x["slug"] != exclude_store), TOP_DISP[0])
    cards.append(("Dispensary", d["name"], f"{d['neighborhood']}, {d['borough']}", f"/dispensaries/{d['slug']}/"))
    nb = next((x for x in TOP_HOODS if slugify(x["neighborhood"]) != exclude_hood), TOP_HOODS[0])
    cards.append(("Neighborhood", nb["neighborhood"], f"{nb['stores']} shops · {nb['borough']}", f"/neighborhoods/{slugify(nb['neighborhood'])}/"))
    br = next((x for x in TOP_BRANDS if slugify(x["brand"]) != exclude_brand), TOP_BRANDS[0])
    cards.append(("Brand", br["brand"], f"{br['stores']} stores stock it", f"/brands/{slugify(br['brand'])}/"))
    cat = next((x for x in SITE["categories"] if x["category"] != exclude_cat and x["category"] != "topicals"), SITE["categories"][0])
    cards.append(("Category", clabel(cat["category"]), f"{cat['in_stock']} across NYC", f"/nyc/{cat['category']}/"))
    return '<div class="xgrid">' + "".join(
        f'<a class="xl" href="{u}"><span class="xk">{k}</span><div class="xv">{esc(v)}</div><div class="xd">{esc(dd)}</div></a>'
        for k, v, dd, u in cards) + '</div>'

# ---------- home + sitemap + robots ----------
def build_home(paths):
    title = "Sensei — Every NYC Dispensary Menu, One Place"
    desc = "Compare prices, potency and pickup across every licensed New York City dispensary. Browse by dispensary, neighborhood, brand or product type."
    cat_chips = "".join(f'<a class="chip" href="/nyc/{c["category"]}/" data-ev="chip" data-cat="{esc(c["category"])}">{esc(clabel(c["category"]))} <span class="c">{c["in_stock"]}</span></a>' for c in SITE["categories"])
    hood_chips = "".join(f'<a class="chip" href="/neighborhoods/{slugify(n["neighborhood"])}/" data-ev="chip" data-hood="{esc(n["neighborhood"])}">{esc(n["neighborhood"])} <span class="c">{n["stores"]}</span></a>' for n in TOP_HOODS)
    brand_chips = "".join(f'<a class="chip" href="/brands/{slugify(b["brand"])}/" data-ev="chip" data-brand="{esc(b["brand"])}">{esc(b["brand"])} <span class="c">{b["stores"]}</span></a>' for b in TOP_BRANDS)
    disp_rows = ""
    for d in TOP_DISP[:12]:
        disp_rows += (f'<a class="row" href="/dispensaries/{d["slug"]}/"><div class="l"><div class="snm">{esc(d["name"])}</div>'
                      f'<div class="sd">{esc(d.get("neighborhood") or "")}, {esc(d.get("borough") or "")}</div></div>'
                      f'<div class="sn"><b>{d["in_stock"]}</b>in stock</div></a>')
    body = f"""
<p class="eyebrow">New York · Cannabis Discovery</p>
<h1>Every NYC dispensary, one place.</h1>
<p class="lede">Compare price, potency and pickup across every licensed NYC dispensary — then order where it's right.</p>
<div class="hero"><div class="bn">{len(SITE['dispensaries'])} shops · live menus</div>
<h2>Open Sensei</h2><p>Search by vibe or by the details, across the whole city.</p>
<a class="cta" href="{APP}/" data-ev="menu">Launch Sensei →</a></div>
<div class="sh">By product</div><div class="chips">{cat_chips}</div>
<div class="sh">Neighborhoods</div><div class="chips">{hood_chips}</div>
<div class="sh">Brands</div><div class="chips">{brand_chips}</div>
<div class="sh">Dispensaries</div>{disp_rows}
"""
    write("/", page(title, desc, "/", [breadcrumb([("Sensei", "/")])], body, "home", None))

def build_sitemap(paths):
    today = SITE["generatedAt"]
    urls = "".join(f"<url><loc>{SITE_URL}{p}</loc><lastmod>{today}</lastmod></url>" for p in paths)
    (DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n")

if __name__ == "__main__":
    import shutil
    if DIST.exists(): shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    paths = ["/"]
    for d in SITE["dispensaries"]: paths.append(build_dispensary(d))
    for n in SITE["neighborhoods"]: paths.append(build_neighborhood(n))
    for b in SITE["brands"]: paths.append(build_brand(b))
    for c in SITE["categories"]: paths.append(build_category(c))
    build_home(paths)
    build_sitemap(paths)
    print(f"Built {len(paths)} pages → {DIST}")
    print(f"  {len(SITE['dispensaries'])} dispensaries · {len(SITE['neighborhoods'])} neighborhoods · "
          f"{len(SITE['brands'])} brands · {len(SITE['categories'])} categories · home · sitemap · robots")
