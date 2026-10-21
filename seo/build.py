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

# Supabase — for the first-party pageview beacon. The anon key is public by
# design (ships in the app bundle; insert-only on pageviews via RLS).
SUPABASE_URL = os.environ.get("SENSEI_SUPABASE_URL", "https://dywrisybvcorpfhbwgtg.supabase.co")
SUPABASE_ANON = os.environ.get(
    "SENSEI_SUPABASE_ANON",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5d3Jpc3lidmNvcnBmaGJ3Z3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDEyMzcsImV4cCI6MjA5NTg3NzIzN30.FgI4VqSYuInl2RDOzeNB4BLVTkYI-PaB7up0JTXmcnw",
)

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

# ---------- editorial copy ----------
# Hand-written per-page copy lives in seo/data/copy/*.json, keyed by page slug
# (dispensary slug, slugified neighborhood/brand name, category key). Every page
# MUST have an entry — the build refuses to emit a page without one, so a thin
# or placeholder page can never ship again.
#   { "<slug>": { "intro": [para, ...], "know": [bullet, ...],
#                 "faq": [{"q": "...", "a": "..."}, ...] } }
COPY_DIR = ROOT / "data" / "copy"
def _load_copy():
    out = {"dispensary": {}, "neighborhood": {}, "brand": {}, "category": {}}
    files = {"dispensary": sorted(COPY_DIR.glob("dispensaries-*.json")),
             "neighborhood": [COPY_DIR / "neighborhoods.json"],
             "brand": [COPY_DIR / "brands.json"],
             "category": [COPY_DIR / "categories.json"]}
    for kind, paths in files.items():
        for p in paths:
            for k, v in json.loads(p.read_text()).items():
                if k in out[kind]:
                    raise SystemExit(f"duplicate copy for {kind} '{k}' in {p.name}")
                out[kind][k] = v
    return out
COPY = _load_copy()

MIN_INTRO_WORDS, MIN_KNOW, MIN_FAQ = 120, 3, 3
def get_copy(kind, key, label):
    c = COPY[kind].get(key)
    if not c:
        raise SystemExit(f"missing copy: {kind} '{key}' ({label}) — add it to seo/data/copy/")
    intro, know, faq = c.get("intro") or [], c.get("know") or [], c.get("faq") or []
    words = sum(len(p.split()) for p in intro)
    if words < MIN_INTRO_WORDS or len(know) < MIN_KNOW or len(faq) < MIN_FAQ:
        raise SystemExit(f"thin copy: {kind} '{key}' — {words} intro words, {len(know)} bullets, {len(faq)} FAQs")
    for q in faq:
        if not (q.get("q") and q.get("a")):
            raise SystemExit(f"bad FAQ entry in {kind} '{key}'")
    return c

def copy_intro(c):
    return '<div class="intro">' + "".join(f"<p>{esc(p)}</p>" for p in c["intro"]) + "</div>"

def copy_sections(c, subject):
    know = "".join(f"<li>{esc(k)}</li>" for k in c["know"])
    faq = "".join(f'<details class="qa"><summary>{esc(q["q"])}</summary><p>{esc(q["a"])}</p></details>' for q in c["faq"])
    return (f'<div class="sh">Good to know</div><ul class="know">{know}</ul>'
            f'<div class="sh">{esc(subject)} FAQ</div><div class="faq">{faq}</div>')

def faq_ld(c):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q["q"],
                            "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in c["faq"]]}

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
CSS = r"""
:root{--field:#0B0B0B;--deep:#1E1E1E;--ink:#FFFFFF;--mist:rgba(255,255,255,.6);--line:rgba(255,255,255,.16);--line-strong:rgba(255,255,255,.4);
--r:#EE352E;--g:#00933C;--b:#0039A6;--y:#FCCC0A;--o:#FF6319;--gr:#A7A9AC;--v:#B933AD;--lg:#6CBE45;--t:#00ADD0;--s:#808183;
--font:"Helvetica Neue",Helvetica,Inter,Arial,sans-serif;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;background:var(--field);color:var(--ink);font-family:var(--font);-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
body{font-size:15px;line-height:1.4}
a{color:inherit;text-decoration:none}
button{font-family:inherit;font-size:inherit;letter-spacing:inherit;cursor:pointer;background:none;border:0;color:inherit;padding:0;text-align:left}
.wrap{max-width:520px;margin:0 auto;padding:0 28px 60px}
@media (min-width:700px){.wrap{max-width:560px}}
/* chrome */
.top{display:flex;align-items:center;justify-content:space-between;padding:22px 0 16px;font-size:14px;font-weight:700;border-bottom:1px solid var(--line)}
.top .tl{display:flex;align-items:center;gap:12px}
.top .tr{font-weight:400;color:var(--mist)}
.wm{font-size:42px;font-weight:700;letter-spacing:-.04em;line-height:1}
.burger{display:block;width:18px;height:14px;position:relative;flex:none}
.mnu{display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:var(--ink);background:none;border:0;padding:0;cursor:pointer;text-decoration:none}
.burger::before,.burger::after{content:"";position:absolute;left:0;width:18px;height:2px;background:var(--ink)}
.burger::before{top:0;box-shadow:0 6px 0 var(--ink)}.burger::after{top:12px}
.burger-x::before,.burger-x::after{top:6px;left:-2px;width:22px;box-shadow:none}
.burger-x::before{transform:rotate(45deg)}.burger-x::after{transform:rotate(-45deg)}
/* roles */
.mark{font-size:clamp(64px,19vw,88px);font-weight:700;letter-spacing:-.05em;line-height:.9;margin:54px 0 0}
.lede{font-size:21px;font-weight:400;line-height:1.3;margin:22px 0 0;max-width:22ch;letter-spacing:-.015em}
.lede.sm{font-size:17px;max-width:34ch;margin-top:14px}
.poster,h1{font-size:32px;font-weight:700;letter-spacing:-.03em;line-height:1;margin:14px 0 0}
main>h1:first-child{font-size:clamp(64px,19vw,88px);letter-spacing:-.05em;line-height:.9;margin:54px 0 0}
.label{font-size:17px;font-weight:700;letter-spacing:-.02em}
.meta{font-size:13px;font-weight:400;color:var(--mist)}
.ghost{font-size:14px;font-weight:400;color:var(--mist);display:inline-block}
.ghost:hover{color:var(--ink)}
.k{font-size:13px;font-weight:700;margin:26px 0 0}
.k small{font-weight:400;color:var(--mist);margin-left:10px;font-size:12px}
.rule{height:2px;background:var(--ink);margin:40px 0 0}
.hair{height:1px;background:var(--line)}
.cta{display:flex;justify-content:space-between;align-items:center;width:100%;background:var(--ink);color:#111;padding:18px 20px;font-size:19px;font-weight:700;letter-spacing:-.025em;margin:28px 0 0}
.cta span:last-child{font-size:26px;font-weight:400;line-height:1}
.cta.ghost{background:transparent;color:var(--ink);border:2px solid var(--ink)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);margin:30px 0 0;gap:18px}
.stats b,.stat .n{display:block;font-size:40px;font-weight:700;letter-spacing:-.05em;line-height:1}
.stats span,.stat .k{display:block;font-size:13px;color:var(--mist);margin-top:6px;font-weight:400}
.stat{display:flex;flex-direction:column}
.stat .n{color:var(--ink)}
/* line bullets + routes (the only colors) */
.bullets{display:flex;justify-content:center;gap:12px;margin:34px 0 0}
.bullets .mb{width:50px;height:50px;font-size:30px}
.mb{width:40px;height:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:24px;color:#fff;letter-spacing:-.03em;flex:none}
.mb.y{color:#111}
.mb.s{width:30px;height:30px;font-size:15px}
.shops .row:nth-child(8n+1) .mb.s{background:var(--r)}
.shops .row:nth-child(8n+2) .mb.s{background:var(--g)}
.shops .row:nth-child(8n+3) .mb.s{background:var(--b)}
.shops .row:nth-child(8n+4) .mb.s{background:var(--y);color:#111}
.shops .row:nth-child(8n+5) .mb.s{background:var(--o)}
.shops .row:nth-child(8n+6) .mb.s{background:var(--gr)}
.shops .row:nth-child(8n+7) .mb.s{background:var(--v)}
.shops .row:nth-child(8n+8) .mb.s{background:var(--lg)}
.route{position:relative;margin:26px 0 0;padding-left:34px}
.route:before{content:"";position:absolute;left:11px;top:14px;bottom:14px;width:6px;background:var(--line-color,#EE352E);border-radius:3px}
.stop{position:relative;display:flex;justify-content:space-between;align-items:baseline;padding:13px 0;text-decoration:none;color:var(--ink)}
.stop:before{content:"";position:absolute;left:-30px;top:50%;transform:translateY(-50%);width:14px;height:14px;border-radius:50%;background:var(--ink);border:3px solid var(--field);box-shadow:0 0 0 2px var(--ink)}
.stop .n{font-size:19px;font-weight:700;letter-spacing:-.025em}
.stop .c{font-size:13px;color:var(--mist);font-weight:400}
.stop.xfer:before{width:18px;height:18px;left:-32px}
.notice{border:2px solid var(--ink);padding:18px 20px;margin:28px 0 0}
.notice h3{margin:0;font-size:16px;font-weight:700}
.notice ol{margin:12px 0 0;padding:0;list-style:none}
.notice li{display:flex;gap:14px;padding:10px 0;border-top:1px solid var(--line);font-size:15px;line-height:1.35}
.notice li b{flex:none;width:26px;height:26px;border-radius:50%;background:var(--ink);color:#111;display:inline-flex;align-items:center;justify-content:center;font-size:14px}
.board{margin:18px 0 0;border-top:2px solid var(--ink)}
.board a,.board div{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid var(--line);font-size:16px;font-weight:700;letter-spacing:-.02em}
.board span:last-child{font-weight:400;color:var(--mist);font-size:13px}
.ft{margin:34px 0 0;font-size:12px;color:var(--mist);line-height:1.6}
.ft b{color:var(--ink)}
/* page heads */
.crumb{font-size:13px;font-weight:400;color:var(--mist);margin:30px 0 0}
.crumb a{color:var(--mist)}
.kicker{font-size:13px;font-weight:700;margin:26px 0 0}
.kicker+h1{margin-top:12px}
/* editorial copy */
.intro{margin-top:22px}
.intro p{margin:0 0 12px;font-size:15px;font-weight:400;line-height:1.55;color:var(--ink)}
.intro p:first-child{font-size:17px;line-height:1.35;letter-spacing:-.015em;margin-bottom:16px}
.know{margin:14px 0 0;padding:0;list-style:none}
.know li{margin:0 0 8px;font-size:15px;font-weight:400;line-height:1.45;padding-left:22px;position:relative}
.know li::before{content:"\2192";position:absolute;left:0;font-weight:700}
.faq{display:flex;flex-direction:column;margin-top:8px}
.qa{border-bottom:1px solid var(--line)}
.qa summary{cursor:pointer;list-style:none;padding:14px 0;font-size:16px;font-weight:700;letter-spacing:-.02em;display:flex;justify-content:space-between;gap:12px;align-items:center}
.qa summary::-webkit-details-marker{display:none}
.qa summary::after{content:"+";font-weight:400;font-size:22px;flex:none;color:var(--mist)}
.qa[open] summary::after{content:"\2013"}
.qa p{margin:0;padding:0 0 14px;font-size:15px;font-weight:400;line-height:1.55;color:var(--mist)}
/* hero: rule, kicker, title, line, the one white CTA */
.hero{margin-top:40px;border-top:2px solid var(--ink)}
.hero .bn{font-size:13px;font-weight:700;margin:26px 0 0}
.hero h2{font-size:32px;font-weight:700;letter-spacing:-.03em;line-height:1;margin:14px 0 0}
.hero p{font-size:15px;color:var(--mist);margin:12px 0 0;line-height:1.45}
/* section heads: a 2px rule, then a kicker */
.sh{font-size:13px;font-weight:700;margin:40px 0 0}
.sh::before{content:"";display:block;height:2px;background:var(--ink);margin-bottom:26px}
.sh+.card,.sh+.shops,.sh+.bars,.sh+.chips,.sh+.xgrid,.sh+.faq,.sh+.know{margin-top:14px}
/* product rows */
.card{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--line)}
.tile{width:44px;height:44px;border-radius:50%;flex:none;overflow:hidden;border:1px solid var(--line);background:var(--deep);display:block}
.tile img{width:100%;height:100%;object-fit:cover;display:block}
.card .l{flex:1;min-width:0}
.card .nm{font-size:17px;font-weight:700;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .mt{font-size:13px;color:var(--mist);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .r{text-align:right;white-space:nowrap}
.card .pr{font-size:17px;font-weight:700;letter-spacing:-.02em}
.card .pg{font-size:13px;color:var(--mist)}
/* tabs: one scrolling row, scrollbar hidden */
.chips{display:flex;gap:22px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.chips::-webkit-scrollbar{display:none}
.chip{font-size:13px;font-weight:400;color:var(--mist);border-bottom:2px solid transparent;padding:6px 0;white-space:nowrap;flex:none}
.chip .c{margin-left:4px}
.chip.on,.chip:hover{color:var(--ink);border-bottom-color:var(--ink)}
/* shop rows: 30px line bullet with the initial */
.row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid var(--line)}
.row .l{display:flex;align-items:center;gap:14px;min-width:0;flex:1}
.row .snm{font-size:17px;font-weight:700;letter-spacing:-.02em}
.row .sd{font-size:13px;color:var(--mist);margin-top:2px}
.row .sn{font-size:13px;color:var(--mist);white-space:nowrap;text-align:right}
.row .sn b{display:block;color:var(--ink);font-size:17px;font-weight:700;letter-spacing:-.02em}
/* category bars */
.bars{display:flex;flex-direction:column}
.brow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.brow .bk{width:96px;font-size:15px;font-weight:700;letter-spacing:-.02em;flex:none}
.brow .bt{flex:1;height:2px;background:var(--line);min-width:0}
.brow .bf{display:block;height:100%;background:var(--ink)}
.brow .bn{width:46px;text-align:right;font-size:13px;color:var(--mist);flex:none}
/* spec grid */
.xgrid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
.xl{display:block;padding:12px 0;border-bottom:1px solid var(--line)}
.xl .xk{font-size:11px;color:var(--mist)}
.xl .xv{font-size:17px;font-weight:700;letter-spacing:-.02em;margin-top:4px}
.xl .xd{font-size:13px;color:var(--mist);margin-top:2px}
/* age gate */
#ag{position:fixed;inset:0;z-index:90;background:var(--field);overflow:auto}
#ag #ag .box{max-width:520px;margin:0 auto;padding:0 28px 60px}
#ag .cta{margin-top:34px}
#ag .ghost{display:block;margin-top:22px}
.ag-ok #ag{display:none}
/* menu: full-screen sheet, slides in from the left */
#menu{position:fixed;inset:0;z-index:80;background:var(--field);overflow:auto;display:none}
#menu .mbody{max-width:520px;margin:0 auto;padding:0 28px 40px}
@media (min-width:700px){#menu .mbody{max-width:560px}}
.menu-open #menu{display:block;animation:menuIn .18s ease-out both}
.menu-open body{overflow:hidden}
@keyframes menuIn{from{transform:translateX(-100%)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.menu-open #menu{animation:none}}
#menu .grp{margin-top:8px}
.mi{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line);color:var(--ink)}
.mi .ml{display:flex;align-items:center;gap:12px;min-width:0}
.mi .mn{font-size:13px;width:28px;flex:none;color:var(--mist)}
.mi .mt{display:block;font-size:17px;font-weight:700;letter-spacing:-.02em;line-height:1.1}
.mi.now .mt{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
.mi .md{display:block;margin-top:2px;font-size:13px;color:var(--mist)}
.mi .ma{font-size:20px;font-weight:400;flex:none}
#menu .about{margin-top:12px;font-size:15px;font-weight:400;line-height:1.55;color:var(--mist)}
#menu .meta{display:block;margin-top:14px}
"""

def menu_html(path, counts):
    """The menu sheet, as static HTML on every page. Links into the app with the
    same ?entry= hints the home's "Start here" rows use."""
    # The Find rows carry the same lettered line bullets as the app's home;
    # other rows have no marker.
    colors = {"N": ("var(--y)", " y"), "B": ("var(--o)", ""), "S": ("var(--s)", ""), "E": ("var(--b)", "")}
    def row(n, title, desc, href, now=False):
        bullet = ""
        if n in colors:
            bg, y = colors[n]
            bullet = f'<span class="mb s{y}" style="background:{bg}">{n}</span>'
        return (f'<a class="mi{" now" if now else ""}" href="{href}" data-ev="chip" data-cat="menu:{esc(title.lower())}">'
                f'<span class="ml">{bullet}<span><span class="mt">{esc(title)}</span>'
                f'<span class="md">{esc(desc)}</span></span></span><span class="ma">→</span></a>')
    stores, hoods, products = counts
    return f"""
<div id="menu" role="dialog" aria-modal="true" aria-label="Menu">
<div class="mbody">
<div class="top"><span class="wm">Sensei</span><button class="mnu" type="button" id="menu-close" aria-label="Close menu">Close ✕</button></div>
<div class="grp"><div class="k">Find</div>
{row("N", "Shops near me", "Share location · closest shops first", f"{APP}/?near=1")}
{row("B", "Pick a borough", "Manhattan · Brooklyn · Queens", f"{APP}/?entry=borough")}
{row("S", "Search in your words", "Strain, brand, price or neighborhood", f"{APP}/?entry=search")}
{row("E", "See everything", f"{products:,} products · cheapest first", f"{APP}/?entry=all")}
</div>
<div class="grp"><div class="k">Browse</div>
{row("", "Neighborhoods", f"{hoods} areas · {stores} shops", "/neighborhoods/", path == "/neighborhoods/")}
{row("", "Brands", "Ayrloom, MFNY, Ruby Farms…", "/brands/", path == "/brands/")}
{row("", "Products", "Flower · pre-rolls · vapes · edibles", "/nyc/", path == "/nyc/")}
{row("", "Deals", "Worth a look this week", f"{APP}/?entry=deals")}
</div>
<div class="grp"><div class="k">You</div>
{row("", "Cart", "Open in the app", f"{APP}/?entry=cart")}
{row("", "The weekly drop", "Deals and standouts by email", f"{APP}/#drop")}
</div>
<div class="grp"><div class="k">About</div>
<p class="about">Sensei is an independent guide to New York's licensed dispensaries. Prices and stock come from each shop's live menu and refresh nightly. We don't sell anything; you order on the dispensary's own site.</p>
<span class="meta">21+ · adults in New York State</span>
</div></div></div>
<script>(function(){{var h=document.documentElement,o=document.getElementById('menu-open'),c=document.getElementById('menu-close');
function open(){{h.classList.add('menu-open');try{{history.pushState({{menu:1}},'')}}catch(e){{}}}}
function close(){{h.classList.remove('menu-open')}}
if(o)o.onclick=function(){{open()}};if(c)c.onclick=function(){{close();try{{if(history.state&&history.state.menu)history.back()}}catch(e){{}}}};
window.addEventListener('popstate',close);document.addEventListener('keydown',function(e){{if(e.key==='Escape')close()}});
}})();</script>"""

MENU_COUNTS = (len(SITE["dispensaries"]), len(SITE["neighborhoods"]), sum(c["in_stock"] for c in SITE["categories"]))

AGE_GATE = """
<div id="ag" role="dialog" aria-label="Age check" aria-modal="true"><div class="box">
<div class="top"><span class="tl"><span class="wm">Sensei</span></span></div>
<h1 class="mark">Are you<br>21 or<br>older?</h1>
<p class="lede">Cannabis products are for adults 21 and over in New York State.</p>
<button class="cta" id="agy" type="button"><span>Yes, I'm 21 or older</span><span>→</span></button>
<a class="ghost" href="https://www.google.com">I'm under 21</a></div></div>
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
    cfg = {"key": POSTHOG_KEY, "host": POSTHOG_HOST, "page_type": page_type,
           "sb_url": SUPABASE_URL, "sb_key": SUPABASE_ANON}
    for k, v in (ctx or {}).items():
        if v:
            cfg[k] = v
    return """<script>
(function(){var CFG=%s;
function src(){try{var q=new URLSearchParams(location.search),s=(q.get('src')||'').toLowerCase();
if(s.indexOf('qr')===0)return'qr';var m=(q.get('utm_medium')||'').toLowerCase(),u=(q.get('utm_source')||'').toLowerCase();
if(['cpc','ppc','paid','paidsearch','display'].indexOf(m)>=0||/ad/.test(u))return'ad';
var r=document.referrer;if(!r)return'direct';var h=new URL(r).hostname.replace(/^www\\./,'');
if(h===location.hostname)return'direct';
if(/(^|\\.)(google|bing|duckduckgo|yahoo|ecosia|brave)\\./.test(h)||h.indexOf('search')>=0)return'organic';
if(/(instagram|facebook|t\\.co|twitter|x\\.com|reddit|tiktok|linkedin|youtube|pinterest|threads)/.test(h))return'social';
return'direct';}catch(e){return'direct';}}
var SRC=src(),BOT=/bot|crawl|spider|slurp|preview/i.test(navigator.userAgent);
function id(store,k){try{var v=store.getItem(k);if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);store.setItem(k,v);}return v;}catch(e){return'na';}}
var SID=id(sessionStorage,'sensei_sid'),VID=id(localStorage,'sensei_vid');
var DEV=/Mobi|Android/i.test(navigator.userAgent)?'mobile':'desktop';
var INT=false;try{var mq=new URLSearchParams(location.search).get('me');if(mq==='1')localStorage.setItem('sensei_internal','1');else if(mq==='0')localStorage.removeItem('sensei_internal');INT=localStorage.getItem('sensei_internal')==='1';}catch(e){}
function sb(table,row){if(BOT||!CFG.sb_url||!CFG.sb_key)return;try{fetch(CFG.sb_url+'/rest/v1/'+table,{method:'POST',keepalive:true,headers:{'apikey':CFG.sb_key,'Authorization':'Bearer '+CFG.sb_key,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(row)}).catch(function(){});}catch(e){}}
try{var pk='sensei_pv_'+location.pathname,last=+(sessionStorage.getItem(pk)||0);
if(Date.now()-last>1800000){sessionStorage.setItem(pk,String(Date.now()));var ref=null;try{ref=document.referrer?new URL(document.referrer).hostname:null;}catch(e){}
sb('pageviews',{path:location.pathname,page_type:CFG.page_type,source:SRC,referrer:ref,session_id:SID,visitor_id:VID,device:DEV,internal:INT,brand:CFG.brand||null,dispensary:CFG.dispensary||null,neighborhood:CFG.neighborhood||null});}}catch(e){}
var PH=false;
if(!INT&&CFG.key&&CFG.key.indexOf('__')!==0){try{
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister getFeatureFlag isFeatureEnabled".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init(CFG.key,{api_host:CFG.host,capture_pageview:true,autocapture:false,person_profiles:'identified_only'});
var base={brand:CFG.brand||null,product_key:null,dispensary:CFG.dispensary||null,neighborhood:CFG.neighborhood||null,page_type:CFG.page_type,source:SRC};
if(CFG.category)base.category=CFG.category;posthog.register(base);PH=true;}catch(e){}}
function ev(name,p){p=p||{};sb('events',{event:name,path:location.pathname,page_type:CFG.page_type,source:SRC,session_id:SID,visitor_id:VID,internal:INT,brand:p.brand||CFG.brand||null,product_key:p.product_key||null,dispensary:p.dispensary||CFG.dispensary||null,neighborhood:p.neighborhood||CFG.neighborhood||null,category:p.category||CFG.category||null,props:p});if(PH){try{posthog.capture(name,p);}catch(e){}}}
if(CFG.page_type==='brand')ev('brand_view',{});
function cp(el){return{brand:el.getAttribute('data-brand')||CFG.brand||null,product_key:el.getAttribute('data-product-key')||null,category:el.getAttribute('data-category')||CFG.category||null};}
try{var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){ev('product_impression',cp(x.target));io.unobserve(x.target);}});},{threshold:0.5});
document.querySelectorAll('.card[data-ev="product"]').forEach(function(el){io.observe(el);});}catch(e){}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-ev]');if(!a)return;var t=a.getAttribute('data-ev');
if(t==='chip')ev('chip_tap',{brand:a.getAttribute('data-brand')||null,neighborhood:a.getAttribute('data-hood')||null,category:a.getAttribute('data-cat')||null,label:(a.textContent||'').trim()});
else if(t==='menu')ev('menu_click',{brand:a.getAttribute('data-brand')||CFG.brand||null,dispensary:a.getAttribute('data-dispensary')||CFG.dispensary||null,url:a.getAttribute('href')||null});},true);
})();
</script>""" % json.dumps(cfg)
def page(title, desc, path, jsonld, body, page_type=None, ctx=None):
    canon = SITE_URL + path
    ld = "".join(f'<script type="application/ld+json">{json.dumps(j)}</script>' for j in jsonld)
    # The top line's right side names the borough on shop and neighborhood
    # pages; everything else is the city. Not an analytics property.
    ctx = dict(ctx or {})
    place = ctx.pop("borough", None) or "New York City"
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0B0B0B">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{canon}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>{CSS}</style>{ld}</head><body>
<div class="wrap">
<div class="top"><a class="wm" href="/">Sensei</a><button class="mnu" type="button" id="menu-open" aria-label="Menu"><span class="burger"></span>Menu</button></div>
<main>{body}</main>
<div class="rule"></div>
<footer class="ft"><b>Sensei</b> is a guide for adults 21 and over in New York State. We list licensed retailers only, link to each dispensary's own menu, and do not sell cannabis. Brands may advertise on Sensei; they may not change the order of results.<br><br>sensei.nyc · hello@sensei.nyc</footer>
</div>{menu_html(path, MENU_COUNTS)}{AGE_GATE}{analytics_js(page_type, ctx)}</body></html>
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
    img = f'<img src="{esc(p.get("image_url"))}" alt="" loading="lazy">' if p.get("image_url") else ""
    # One meta line: brand · strain · THC · type, whichever are present.
    bits = [p.get("brand"), p.get("strain_type")]
    if thc_ok(p): bits.append(f'{round(p["thc_pct"])}% THC')
    if p.get("category"): bits.append(clabel(p["category"]))
    meta = " · ".join(esc(b) for b in bits if b)
    name = p.get("name") or ""
    attrs = (f'data-ev="product" data-brand="{esc(p.get("brand") or "")}" '
             f'data-product-key="{esc(pkey(p.get("brand"), name))}" '
             f'data-category="{esc(p.get("category") or "")}"')
    return (f'<div class="card" {attrs}><span class="tile">{img}</span><div class="l">'
            f'<div class="nm">{esc(name)}</div><div class="mt">{meta}</div></div>'
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
        rows += f'<a class="brow" href="{href}" data-ev="chip" data-cat="{esc(cat)}">{inner}</a>'
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
    cp = get_copy("dispensary", d["slug"], d["name"])
    ld.append(faq_ld(cp))
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
<p class="kicker">{esc(d.get('neighborhood') or '')} · {esc(d.get('borough') or '')}</p>
<h1>{esc(d['name'])}</h1>
{copy_intro(cp)}
<div class="stats"><div class="stat"><span class="n">{d['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{d['brands']}</span><span class="k">Brands</span></div>
<div class="stat"><span class="n">{money(d['min_price'])}</span><span class="k">From</span></div></div>
<div class="hero"><div class="bn">{esc(d.get('neighborhood') or 'NYC')} · live menu</div>
<h2>Shop {esc(d['name'])} on Sensei</h2>
<p>Compare every item here against nearby NYC shops — then order where it's cheapest.</p>
<a class="cta" href="{app_store(d['slug'])}" data-ev="menu" data-dispensary="{esc(d['name'])}"><span>Browse {esc(d['name'])}</span><span>→</span></a></div>
<div class="sh">What's on the shelf</div>{cats}
<div class="sh">Top brands here</div><div class="chips">{bchips}</div>
<div class="sh">Featured right now</div>{feat}
{copy_sections(cp, d['name'])}
<div class="sh">Explore Sensei</div>{crosslinks(exclude_store=d['slug'], hood=d.get('neighborhood'))}
"""
    write(path, page(title, desc, path, ld, body, "dispensary",
                     {"dispensary": d["name"], "neighborhood": d.get("neighborhood"), "borough": d.get("borough")}))
    return path

def build_neighborhood(n):
    slug = slugify(n["neighborhood"]); path = f"/neighborhoods/{slug}/"
    title = f"Weed in {n['neighborhood']} — {n['stores']} Dispensaries, Menus & Prices | Sensei"
    desc = (f"Compare {n['stores']} licensed cannabis dispensaries in {n['neighborhood']}, {n['borough']}: "
            f"{n['in_stock']} products in stock. Filter {n['neighborhood']} by category and price on Sensei.")
    ld = [itemlist(f"Dispensaries in {n['neighborhood']}", [s["name"] for s in (n.get("stores_list") or [])]),
          breadcrumb([("Sensei", "/"), ("Neighborhoods", "/neighborhoods/"), (n["neighborhood"], path)])]
    cp = get_copy("neighborhood", slug, n["neighborhood"])
    ld.append(faq_ld(cp))
    cats = catbars(n.get("categories") or {},
                   lambda c: (f"/nyc/{c}/" if c in CAT_SLUGS else app_hood(n["neighborhood"], c)))
    stores = ""
    for s in (n.get("stores_list") or []):
        href = f"/dispensaries/{s['slug']}/" if s["slug"] in STORE_SLUGS else app_store(s["slug"])
        stores += (f'<a class="row" href="{href}"><div class="l"><span class="mb s">{esc((s["name"] or "?")[:1].upper())}</span><div><div class="snm">{esc(s["name"])}</div>'
                   f'<div class="sd">{esc((s.get("address") or "").split(",")[0])}</div></div></div>'
                   f'<div class="sn"><b>{s["in_stock"]}</b>in stock</div></a>')
    stores = f'<div class="shops">{stores}</div>'
    feat = "".join(pcard(p) for p in (n.get("featured") or [])[:4])
    body = f"""
<p class="crumb"><a href="/">Sensei</a> › {esc(n['borough'])} › Neighborhood</p>
<p class="kicker">{esc(n['borough'])}</p>
<h1>Weed in {esc(n['neighborhood'])}</h1>
{copy_intro(cp)}
<div class="stats"><div class="stat"><span class="n">{n['stores']}</span><span class="k">Shops</span></div>
<div class="stat"><span class="n">{n['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{len(n.get('categories') or {})}</span><span class="k">Categories</span></div></div>
<div class="hero"><div class="bn">{n['stores']} shops · one search</div>
<h2>Shop all of {esc(n['neighborhood'])} on Sensei</h2>
<p>Every {esc(n['neighborhood'])} menu in one place, sorted by price and distance.</p>
<a class="cta" href="{app_hood(n['neighborhood'])}" data-ev="menu"><span>Shop {esc(n['neighborhood'])}</span><span>→</span></a></div>
<div class="sh">Filter {esc(n['neighborhood'])} by category</div>{cats}
<div class="sh">Dispensaries in {esc(n['neighborhood'])}</div>{stores}
<div class="sh">Popular right now</div>{feat}
{copy_sections(cp, n['neighborhood'])}
<div class="sh">Explore Sensei</div>{crosslinks(exclude_hood=slug)}
"""
    write(path, page(title, desc, path, ld, body, "neighborhood",
                     {"neighborhood": n["neighborhood"], "borough": n.get("borough")}))
    return path

def build_brand(b):
    slug = slugify(b["brand"]); path = f"/brands/{slug}/"
    title = f"{b['brand']} in NYC — {b['stores']} Dispensaries Stocking It | Sensei"
    desc = (f"Find {b['brand']} at {b['stores']} NYC dispensaries: {b['in_stock']} products from {money(b['min_price'])}. "
            f"See every store stocking {b['brand']} and compare prices on Sensei.")
    ld = [itemlist(f"NYC dispensaries stocking {b['brand']}", [s["name"] for s in (b.get("stores_list") or [])]),
          breadcrumb([("Sensei", "/"), ("Brands", "/brands/"), (b["brand"], path)])]
    cp = get_copy("brand", slug, b["brand"])
    ld.append(faq_ld(cp))
    cchips ="".join(f'<span class="chip">{esc(clabel(c))} <span class="c">{n}</span></span>'
                     for c, n in sorted((b.get("categories") or {}).items(), key=lambda kv: -kv[1]))
    stores = ""
    for s in (b.get("stores_list") or []):
        href = f"/dispensaries/{s['slug']}/" if s["slug"] in STORE_SLUGS else app_store(s["slug"])
        hs = slugify(s.get("neighborhood") or "")
        place = (f'<a href="/neighborhoods/{hs}/">{esc(s.get("neighborhood"))}</a>' if hs in HOOD_SLUGS else esc(s.get("neighborhood") or ""))
        stores += (f'<a class="row" href="{href}"><div class="l"><span class="mb s">{esc((s["name"] or "?")[:1].upper())}</span><div><div class="snm">{esc(s["name"])}</div>'
                   f'<div class="sd">{place}, {esc(s.get("borough") or "")}</div></div></div>'
                   f'<div class="sn"><b>{money(s.get("min_price"))}</b>from · {s["n"]} items</div></a>')
    stores = f'<div class="shops">{stores}</div>'
    feat = "".join(pcard({**p, "brand": b["brand"]}) for p in (b.get("featured") or [])[:4])
    body = f"""
<p class="crumb"><a href="/">Sensei</a> › Brands › {esc(b['brand'])}</p>
<p class="kicker">Brand</p>
<h1>{esc(b['brand'])} in NYC</h1>
{copy_intro(cp)}
<div class="stats"><div class="stat"><span class="n">{b['stores']}</span><span class="k">Stores stock it</span></div>
<div class="stat"><span class="n">{b['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{money(b['min_price'])}</span><span class="k">From</span></div></div>
<div class="hero"><div class="bn">Carried at {b['stores']} shops</div>
<h2>See every store stocking {esc(b['brand'])}</h2>
<p>Compare {esc(b['brand'])} prices across all {b['stores']} NYC shops on Sensei.</p>
<a class="cta" href="{app_brand(b['brand'])}" data-ev="menu" data-brand="{esc(b['brand'])}"><span>Find {esc(b['brand'])} nearby</span><span>→</span></a></div>
<div class="sh">What {esc(b['brand'])} makes</div><div class="chips">{cchips}</div>
<div class="sh">Stores carrying {esc(b['brand'])}</div>{stores}
<div class="sh">Popular {esc(b['brand'])} products</div>{feat}
{copy_sections(cp, b['brand'])}
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
    cp = get_copy("category", cat, label)
    ld.append(faq_ld(cp))
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
<p class="kicker">New York City</p>
<h1>{esc(label)} in NYC</h1>
{copy_intro(cp)}
<div class="stats"><div class="stat"><span class="n">{c['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{c['stores']}</span><span class="k">Dispensaries</span></div>
<div class="stat"><span class="n">{money(c['min_price'])}</span><span class="k">From</span></div></div>
<div class="hero"><div class="bn">{c['brands']} brands · {c['stores']} shops</div>
<h2>Find the best {esc(label.lower())} near you</h2>
<p>Every NYC {esc(label.lower())} listing, ranked by price and distance on Sensei.</p>
<a class="cta" href="{app_cat(cat)}" data-ev="menu" data-cat="{esc(cat)}"><span>Browse {esc(label.lower())}</span><span>→</span></a></div>
<div class="sh">Top {esc(label.lower())} brands</div><div class="chips">{bchips}</div>
<div class="sh">Where it's stocked</div><div class="chips">{hchips}</div>
<div class="sh">Featured {esc(label.lower())}</div>{feat}
{copy_sections(cp, label)}
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
    """The home, one-for-one with design/subway-landing.html, live numbers in."""
    title = "Sensei — every licensed cannabis menu in NYC"
    desc = ("Stop checking menus one shop at a time. Every licensed dispensary in New York, side by side: price, THC and distance, updated nightly. "
            "Browse by neighborhood, brand or product type.")
    n_shops = len(SITE["dispensaries"])
    products = sum(c["in_stock"] for c in SITE["categories"])
    products_k = f"{round(products / 1000)}k" if products >= 1000 else str(products)
    n_hoods = len(SITE["neighborhoods"])
    # Route groups: "Downtown & Brooklyn" = lower Manhattan + Brooklyn, by the
    # TOP_HOODS order; "Uptown & Queens" = the next four elsewhere. The two
    # biggest shop counts in each group are transfer stations.
    lower = {"East & West Village", "Chinatown & LES", "SoHo", "FiDi", "Gramercy & Union Square", "Chelsea & Flatiron"}
    def downtown(h): return h.get("borough") == "Brooklyn" or h["neighborhood"] in lower
    g1 = [h for h in TOP_HOODS if downtown(h)][:5]
    g2 = [h for h in TOP_HOODS if not downtown(h)][:4]
    def route(group, color):
        xfer = {h["neighborhood"] for h in sorted(group, key=lambda h: -h["stores"])[:2]}
        stops = "".join(
            f'<a class="stop{" xfer" if h["neighborhood"] in xfer else ""}" href="/neighborhoods/{slugify(h["neighborhood"])}/" '
            f'data-ev="chip" data-hood="{esc(h["neighborhood"])}"><span class="n">{esc(h["neighborhood"])}</span>'
            f'<span class="c">{h["stores"]} shop{"s" if h["stores"] != 1 else ""}</span></a>'
            for h in group)
        return f'<div class="route" style="--line-color:var(--{color})">{stops}</div>'
    board = "".join(
        f'<a href="/brands/{slugify(b["brand"])}/" data-ev="chip" data-brand="{esc(b["brand"])}"><span>{esc(b["brand"])}</span><span>{b["stores"]} shops</span></a>'
        for b in sorted(SITE["brands"], key=lambda b: -b["stores"])[:5])
    body = f"""
<h1>Every<br>menu.<br>One stop.</h1>
<p class="lede">Stop checking menus one shop at a time. Every licensed dispensary in New York, side by side: price, THC and distance, updated nightly.</p>
<div class="bullets"><span class="mb" style="background:#00933C">T</span><span class="mb" style="background:#6CBE45">H</span><span class="mb" style="background:#1B5E3A">C</span></div>
<a class="cta" href="{APP}/?near=1" data-ev="menu"><span>Shops near me</span><span>→</span></a>
<div class="stats"><div><b>{n_shops}</b><span>licensed shops</span></div><div><b>{products_k}</b><span>items in stock</span></div><div><b>{n_hoods}</b><span>neighborhoods</span></div></div>
<div class="rule"></div>
<div class="k">Downtown &amp; Brooklyn<small>most shops</small></div>
{route(g1, "gr")}
<div class="hair"></div>
<div class="k">Uptown &amp; Queens</div>
{route(g2, "r")}
<div class="notice">
<h3>How Sensei works</h3>
<ol>
<li><b>1</b><span>Pick a neighborhood or share your location.</span></li>
<li><b>2</b><span>Compare every shop's menu in one list: price, THC, size, distance.</span></li>
<li><b>3</b><span>Order on the dispensary's own menu for pickup. We never hold your cart.</span></li>
</ol>
</div>
<div class="rule"></div>
<div class="k">Brands carried this week</div>
<div class="board">{board}</div>
<a class="cta ghost" href="{APP}/?entry=all" data-ev="menu"><span>Browse all {n_shops} shops</span><span>→</span></a>
"""
    write("/", page(title, desc, "/", [breadcrumb([("Sensei", "/")])], body, "home", None))

# ---------- index pages (the menu's Browse group) ----------
def _index(path, title, h1, lede, rows, crumb_name, exclude):
    desc = lede
    ld = [itemlist(h1, [r[0] for r in rows]), breadcrumb([("Sensei", "/"), (crumb_name, path)])]
    body_rows = "".join(
        f'<a class="row" href="{href}"><div class="l"><span class="mb s">{esc(name[:1].upper())}</span><div><div class="snm">{esc(name)}</div>'
        f'<div class="sd">{esc(sub)}</div></div></div><div class="sn"><b>{n}</b>{esc(unit)}</div></a>'
        for name, sub, n, unit, href in rows)
    body = f"""
<p class="crumb"><a href="/">Sensei</a> › {esc(crumb_name)}</p>
<h1>{esc(h1)}</h1>
<p class="lede sm">{esc(lede)}</p>
<div class="sh">{len(rows)} {esc(crumb_name.lower())}</div><div class="shops">{body_rows}</div>
<div class="sh">Explore Sensei</div>{crosslinks(**exclude)}
"""
    write(path, page(title, desc, path, ld, body, "index", None))
    return path

def build_index_neighborhoods():
    rows = [(n["neighborhood"], f"{n['borough']} · {n['stores']} shop{'s' if n['stores'] != 1 else ''}", n["in_stock"], "in stock",
             f"/neighborhoods/{slugify(n['neighborhood'])}/") for n in TOP_HOODS]
    return _index("/neighborhoods/", "NYC Dispensaries by Neighborhood | Sensei", "Neighborhoods",
                  "Every part of the city with a licensed dispensary, from Midtown's seven shops to the two in Park Slope. "
                  "Each page lists the shops, what they stock, and what is cheapest there right now.",
                  rows, "Neighborhoods", {"exclude_hood": "__none__"})

def build_index_brands():
    rows = [(b["brand"], f"{b['stores']} stores stock it", b["in_stock"], "in stock", f"/brands/{slugify(b['brand'])}/")
            for b in sorted(SITE["brands"], key=lambda b: -b["stores"])]
    return _index("/brands/", "Cannabis Brands in NYC | Sensei", "Brands",
                  "The most widely stocked brands on New York's licensed menus, from Ayrloom at nearly every shop to Good Tide "
                  "at a few dozen. Each page shows every store carrying the brand and where it is cheapest.",
                  rows, "Brands", {"exclude_brand": "__none__"})

def build_index_categories():
    rows = [(clabel(c["category"]), f"{c['brands']} brands · {c['stores']} shops", c["in_stock"], "in stock", f"/nyc/{c['category']}/")
            for c in sorted(SITE["categories"], key=lambda c: -c["in_stock"])]
    return _index("/nyc/", "Flower, Pre-Rolls, Vapes & Edibles in NYC | Sensei", "Products",
                  "Every product type sold at New York's licensed dispensaries, with the brands that lead each one and the "
                  "neighborhoods where the selection runs deepest.",
                  rows, "Products", {"exclude_cat": "__none__"})

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
    paths.append(build_index_neighborhoods())
    paths.append(build_index_brands())
    paths.append(build_index_categories())
    build_home(paths)
    build_sitemap(paths)
    # Hard guard: no page may ship with placeholder text or unrendered braces.
    bad = []
    for f in DIST.rglob("index.html"):
        t = f.read_text()
        body = t.split("<main", 1)[-1].split("</main>", 1)[0]
        if "{prose}" in t or "{{" in body or "}}" in body or "lorem ipsum" in t.lower():
            bad.append(str(f.relative_to(DIST)))
    if bad:
        raise SystemExit("placeholder text found in: " + ", ".join(bad))
    print(f"Built {len(paths)} pages → {DIST}")
    print(f"  {len(SITE['dispensaries'])} dispensaries · {len(SITE['neighborhoods'])} neighborhoods · "
          f"{len(SITE['brands'])} brands · {len(SITE['categories'])} categories · home · sitemap · robots")
