# Traffic

Who visits sensei.nyc, when, from where, and what they click. One
definition of a visit and its channel, kept in the database
(`supabase/traffic.sql`), applied the same way to all history.

## Tag every link you control

A link with no tag shows up as **untagged**, which can mean a typed URL, a
bookmark, an app that hides where it came from, or a bot. Tag every link
you place so it's counted where it belongs.

**Meta ads.** In Ads Manager, open each ad → *Destination* → *URL
parameters* and paste:

```
utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

Meta fills in the campaign and ad names, so the report can compare ads
without separate links.

**Anything else** (Instagram bio, flyers and QR codes, a newsletter, a
partner's site): add `?src=<where>` to the link, short and lower case:

| Place | Link |
|---|---|
| Instagram bio | `https://sensei.nyc/?src=ig-bio` |
| A flyer's QR code | `https://sensei.nyc/?src=qr-<flyer name>` |
| The weekly drop | `https://sensei.nyc/?src=newsletter` |

**Search (Google)** needs nothing; it's recognised from the referring site.

## Keep your own visits out

Open `https://sensei.nyc/?me=1` once on every phone, tablet and computer
you use. That device's visits are then excluded from every number, including
its earlier visits. `?me=0` undoes it.

## Channels

| Channel | Meaning |
|---|---|
| Meta ads | a link tagged as a Meta ad (`utm_source=meta…&utm_medium=paid`, or `?src=meta…`) |
| Search | arrived from Google, Bing, DuckDuckGo… |
| Social | arrived from Instagram, Facebook etc. **without** an ad tag |
| Other tagged links | any other `?src=` or `utm_` tag |
| Untagged | none of the above |
| Internal | your marked devices (left out) |

A visit is one browser tab's session. **Did something** means any tracked
action after landing. **Clicks out** are a shop's menu, directions, "Order
at" in the cart, and deal taps. **Probable automated** visits (untagged,
desktop, one page, no referring site, did nothing, located at a data centre
if located at all) are counted separately; headless browsers aren't
recorded at all since Oct 27.

Location is shown two ways: by the connection (from Oct 24; phone carriers
can misplace it) and by the device's own time zone (from Oct 26).

## The report

```
node analytics/report.mjs 2026-10-01 2026-10-31     # needs SUPABASE_SERVICE_ROLE_KEY
```

Writes `analytics/dist/traffic-<start>_<end>.html`. The numbers come from
`traffic_report(start, end)`, which only the service key can run; the
public key sees nothing.
