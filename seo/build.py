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
:root{--field:#F2C230;--deep:#E3B223;--ink:#141414;--mist:rgba(20,20,20,.62);--line:rgba(20,20,20,.22);--line-strong:rgba(20,20,20,.5);
--font:'Barlow Condensed',ui-sans-serif,system-ui,sans-serif;--jp:'Noto Sans JP',sans-serif;color-scheme:light}
*{box-sizing:border-box}
html{background:var(--field)}
body{margin:0;background:var(--field);color:var(--ink);font-family:var(--font);font-size:14px;font-weight:600;line-height:1.5;text-transform:uppercase;-webkit-font-smoothing:antialiased;position:relative}
body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.16;mix-blend-mode:multiply;z-index:1;
 background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 .3 0 0 0 0 .2 0 0 0 0 .05 0 0 0 .6 0'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>")}
a{color:inherit;text-decoration:none}
button{font-family:inherit;text-transform:inherit;cursor:pointer;background:none;border:0;color:inherit;padding:0}
.shell{max-width:420px;margin:0 auto;position:relative;z-index:2}
/* roles */
.mark{font-size:96px;font-weight:700;line-height:.86;letter-spacing:.04em;text-align:center;margin:0}
.poster{font-size:22px;font-weight:700;letter-spacing:.1em;text-align:center;line-height:1.15;margin:0}
.label{font-size:15px;font-weight:700;letter-spacing:.08em}
.meta{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist)}
.ghost{font-size:13px;font-weight:700;letter-spacing:.08em;color:var(--mist);display:inline-block}
.ghost:hover{color:var(--ink)}
.body{font-size:14px;font-weight:600;line-height:1.6;color:var(--mist)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px;text-align:center}
.stat .n,.stat-v{display:block;font-size:22px;font-weight:700;color:var(--ink);line-height:1.1;font-variant-numeric:tabular-nums}
.stat .k,.stat-k{display:block;font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);margin-bottom:4px}
.stat{display:flex;flex-direction:column-reverse}
.rule{display:flex;align-items:center;justify-content:center;gap:12px;font-size:18px;font-weight:700;letter-spacing:.12em;margin:18px 0}
.rule::before,.rule::after{content:"";width:30px;height:2px;background:var(--ink);flex:none}
.kanji{display:flex;justify-content:center;gap:3.6em;font-family:var(--jp);font-weight:500;font-size:30px;line-height:1;text-transform:none}
.dotcta{display:inline-flex;align-items:center;gap:.5em;font-size:22px;font-weight:700;letter-spacing:.1em;line-height:1.15;color:var(--ink);text-align:center;transition:transform .12s}
.dotcta::after{content:'\2192'}
.dotcta:active{transform:translateX(3px)}
.burger{display:block;width:18px;height:12px;position:relative;flex:none}
.burger::before,.burger::after{content:"";position:absolute;left:0;width:18px;height:2px;background:var(--ink)}
.burger::before{top:0}.burger::after{top:7px}
/* chrome */
.hd{display:flex;align-items:center;justify-content:space-between;padding:32px 24px 8px;position:sticky;top:0;background:var(--field);z-index:5}
.wm{font-size:16px;font-weight:700;letter-spacing:.08em}
.hd .est{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist)}
.wrap{padding:18px 24px}
.crumb{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);margin:0 0 10px;text-align:center}
.crumb a{color:var(--mist)}
.kicker{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);margin:0;text-align:center}
h1{font-size:44px;font-weight:700;letter-spacing:.02em;line-height:1;margin:8px 0 0;text-align:center;text-wrap:balance}
.lede{font-size:14px;font-weight:600;line-height:1.6;color:var(--mist);margin:12px auto 0;max-width:60ch;text-align:center}
/* editorial copy — sentence case */
.intro{margin-top:18px;max-width:62ch;text-transform:none}
.intro p{margin:0 0 12px;font-size:15px;font-weight:600;line-height:1.6;color:var(--mist);text-transform:none}
.intro p:first-child{font-size:16px;color:var(--ink)}
.know{margin:0;padding:0;list-style:none;max-width:62ch}
.know li{margin:0 0 8px;font-size:14px;font-weight:600;line-height:1.5;color:var(--mist);text-transform:none;padding-left:22px;position:relative}
.know li::before{content:"\2192";position:absolute;left:0;color:var(--ink);font-weight:700}
.faq{display:flex;flex-direction:column}
.qa{border-bottom:2px solid var(--line);padding:0}
.qa summary{cursor:pointer;list-style:none;padding:14px 0;font-size:15px;font-weight:700;letter-spacing:.08em;display:flex;justify-content:space-between;gap:12px;align-items:center}
.qa summary::-webkit-details-marker{display:none}
.qa summary::after{content:"+";font-weight:700;font-size:20px;flex:none}
.qa[open] summary::after{content:"\2013"}
.qa p{margin:0;padding:0 0 14px;font-size:14px;font-weight:600;line-height:1.55;color:var(--mist);text-transform:none}
/* hero */
.hero{text-align:center;padding:28px 0 8px;margin-top:22px}
.hero .bn{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist)}
.hero h2{font-size:22px;font-weight:700;letter-spacing:.1em;line-height:1.15;margin:8px 0}
.hero p{font-size:14px;font-weight:600;line-height:1.6;color:var(--mist);margin:0 auto 16px;max-width:40ch}
.hero p b{color:var(--ink)}
.cta{display:inline-flex;align-items:center;gap:.5em;font-size:22px;font-weight:700;letter-spacing:.1em;line-height:1.15;color:var(--ink);transition:transform .12s}
.cta::after{content:'\2192'}
.cta:active{transform:translateX(3px)}
.sh{font-size:22px;font-weight:700;letter-spacing:.1em;text-align:center;line-height:1.15;margin:44px 0 10px}
/* rows */
.card{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:2px solid var(--line)}
.tile{width:44px;height:44px;border-radius:50%;flex:none;overflow:hidden;border:2px solid var(--ink);background:var(--deep);display:block}
.tile:empty{background:transparent;border:1px solid var(--line-strong)}
.tile img{width:100%;height:100%;object-fit:cover;mix-blend-mode:multiply;display:block}
.card .l{flex:1;min-width:0}
.card .nm{font-size:15px;font-weight:700;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .mt{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);margin-top:2px}
.tag{display:inline-block;margin-top:2px;margin-right:8px;font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist)}
.tag+.tag::before{content:"\00b7\00a0";}
.card .r{text-align:right;white-space:nowrap}
.card .pr{font-size:15px;font-weight:700;letter-spacing:.08em;font-variant-numeric:tabular-nums}
.card .pg{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);margin-top:1px}
.chips{display:flex;gap:6px 18px;flex-wrap:wrap}
.chip{font-size:13px;font-weight:700;letter-spacing:.08em;color:var(--mist);border-bottom:2px solid transparent;padding:4px 0}
.chip .c{font-variant-numeric:tabular-nums;margin-left:4px}
.chip.on,.chip:hover{color:var(--ink);border-bottom-color:var(--ink)}
.row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:2px solid var(--line)}
.row .l{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.row .l::before{content:"\2192";font-weight:700;flex:none;width:14px}
.row:first-of-type .l::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--ink);margin:0 2px}
.row .snm{font-size:15px;font-weight:700;letter-spacing:.08em}
.row .sd{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);margin-top:2px}
.row .sn{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);white-space:nowrap;text-align:right}
.row .sn b{display:block;color:var(--ink);font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
.bars{display:flex;flex-direction:column}
.bar{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:2px solid var(--line)}
.bar .bk{width:96px;font-size:15px;font-weight:700;letter-spacing:.08em;flex:none}
.bar .bt{flex:1;height:2px;background:var(--line);min-width:0}
.bar .bf{display:block;height:100%;background:var(--ink)}
.bar .bn{width:46px;text-align:right;font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);flex:none;font-variant-numeric:tabular-nums}
.xgrid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
.xl{display:block;padding:14px 0;border-bottom:2px solid var(--line)}
.xl .xk{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist)}
.xl .xv{font-size:15px;font-weight:700;letter-spacing:.08em;margin-top:4px}
.xl .xd{font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--mist);margin-top:2px}
/* masthead (home + age gate) */
.mast{text-align:center;padding:16px 0 0}
.mast .mark{margin-top:24px}
.mast .poster{margin-top:16px}
.mast .arrow{display:block;width:100%;height:auto;margin-top:10px}
.mast .cols{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:-104px;position:relative}
.mast .cols .label{font-size:20px;line-height:1.2;text-align:center;margin:0}
.mast .meta{display:block;margin-top:18px;text-align:center}
.mast .dotcta{margin-top:28px}
/* footer */
.ft{border-top:2px solid var(--line);margin-top:48px;padding:28px 24px 44px;text-align:center}
.ft .poster{margin:0;display:block}
.ft .label{display:block;color:var(--mist);margin-top:12px;font-size:13px}
.ft .meta{display:block;margin-top:12px}
.back{display:inline-block;color:var(--mist);font-size:13px;font-weight:700;letter-spacing:.08em;margin:0 0 14px}
.back:hover{color:var(--ink)}
.back:before{content:"\2190 "}
/* age gate */
#ag{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:24px;text-align:center;background:var(--field);overflow:auto}
#ag .box{max-width:330px;width:100%}
#ag .mark{margin-top:24px}
#ag .poster{margin-top:16px}
#ag .meta{display:block;margin-top:12px;text-transform:none;max-width:30ch;margin-left:auto;margin-right:auto}
#ag .dotcta{margin-top:26px}
#ag .ghost{display:block;margin-top:18px}
.ag-ok #ag{display:none}
"""

AGE_GATE = """
<div id="ag" role="dialog" aria-label="Age check" aria-modal="true"><div class="box">
<div class="kanji"><span>先</span><span>生</span></div>
<h1 class="mark">Sensei</h1>
<p class="poster">Are you 21 or older?</p>
<div class="rule"><span>NY</span></div>
<span class="meta">You must be 21 or older to view licensed cannabis products in New York State.</span>
<button class="dotcta" id="agy" type="button">Yes, I'm 21 or older</button>
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
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light"><meta name="theme-color" content="#F2C230">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{canon}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Noto+Sans+JP:wght@500&display=swap" rel="stylesheet">
<style>{CSS}</style>{ld}</head><body><div class="shell">
<header class="hd"><a class="burger" href="/" aria-label="Home"></a><a class="wm" href="/">Sensei</a><span class="est">21+</span></header>
<main class="wrap">{body}</main>
<footer class="ft"><a class="poster" href="/">Sensei.nyc</a><span class="label">Every licensed NYC dispensary menu, one place. Prices refresh from live menus. Sensei is an independent guide — order on the dispensary's own site.</span><span class="meta">21+ only · adults in New York State</span></footer>
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
    img = f'<img src="{esc(p.get("image_url"))}" alt="" loading="lazy">' if p.get("image_url") else ""
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
<a class="cta" href="{app_store(d['slug'])}" data-ev="menu" data-dispensary="{esc(d['name'])}">Browse {esc(d['name'])}</a></div>
<div class="sh">What's on the shelf</div>{cats}
<div class="sh">Top brands here</div><div class="chips">{bchips}</div>
<div class="sh">Featured right now</div>{feat}
{copy_sections(cp, d['name'])}
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
    cp = get_copy("neighborhood", slug, n["neighborhood"])
    ld.append(faq_ld(cp))
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
<p class="kicker">{esc(n['borough'])}</p>
<h1>Weed in {esc(n['neighborhood'])}</h1>
{copy_intro(cp)}
<div class="stats"><div class="stat"><span class="n">{n['stores']}</span><span class="k">Shops</span></div>
<div class="stat"><span class="n">{n['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{len(n.get('categories') or {})}</span><span class="k">Categories</span></div></div>
<div class="hero"><div class="bn">{n['stores']} shops · one search</div>
<h2>Shop all of {esc(n['neighborhood'])} on Sensei</h2>
<p>Every {esc(n['neighborhood'])} menu in one place, sorted by price and distance.</p>
<a class="cta" href="{app_hood(n['neighborhood'])}" data-ev="menu">Shop {esc(n['neighborhood'])}</a></div>
<div class="sh">Filter {esc(n['neighborhood'])} by category</div>{cats}
<div class="sh">Dispensaries in {esc(n['neighborhood'])}</div>{stores}
<div class="sh">Popular right now</div>{feat}
{copy_sections(cp, n['neighborhood'])}
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
    cp = get_copy("brand", slug, b["brand"])
    ld.append(faq_ld(cp))
    cchips ="".join(f'<span class="chip">{esc(clabel(c))} <span class="c">{n}</span></span>'
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
<p class="kicker">Brand</p>
<h1>{esc(b['brand'])} in NYC</h1>
{copy_intro(cp)}
<div class="stats"><div class="stat"><span class="n">{b['stores']}</span><span class="k">Stores stock it</span></div>
<div class="stat"><span class="n">{b['in_stock']}</span><span class="k">In stock</span></div>
<div class="stat"><span class="n">{money(b['min_price'])}</span><span class="k">From</span></div></div>
<div class="hero"><div class="bn">Carried at {b['stores']} shops</div>
<h2>See every store stocking {esc(b['brand'])}</h2>
<p>Compare {esc(b['brand'])} prices across all {b['stores']} NYC shops on Sensei.</p>
<a class="cta" href="{app_brand(b['brand'])}" data-ev="menu" data-brand="{esc(b['brand'])}">Find {esc(b['brand'])} nearby</a></div>
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
<a class="cta" href="{app_cat(cat)}" data-ev="menu" data-cat="{esc(cat)}">Browse {esc(label.lower())}</a></div>
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
    boroughs = len({d.get("borough") for d in SITE["dispensaries"] if d.get("borough")})
    products = sum(c["in_stock"] for c in SITE["categories"])
    body = f"""
<div class="mast">
<div class="kanji"><span>先</span><span>生</span></div>
<h1 class="mark">Sensei</h1>
<p class="poster">A guide to New York</p>
<svg class="arrow" viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M24 20 H296" stroke="#141414" stroke-width="3" fill="none"/>
<path d="M8 20 l18 -8 l-4 8 l4 8 Z" fill="#141414"/>
<path d="M312 20 l-18 -8 l4 8 l-4 8 Z" fill="#141414"/>
<path d="M160 20 V150" stroke="#141414" stroke-width="3" fill="none"/></svg>
<div class="cols">
<p class="label">{len(SITE['dispensaries'])} licensed<br>shops<br>live menus</p>
<p class="label">compare<br>price &amp;<br>potency</p></div>
<span class="meta">{boroughs} boroughs · {len(SITE['neighborhoods'])} neighborhoods · {products:,} products</span>
<a class="dotcta" href="{APP}/" data-ev="menu">Find a shop</a>
</div>
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
