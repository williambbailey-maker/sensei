"""Diagnostic v5: introspect Dutchie's GraphQL schema to end the guessing.

`filter:` is confirmed the right argument on filteredProducts; both input-type
guesses were wrong and suggestions are hidden. So ask the schema directly:
1) introspect Query.filteredProducts args -> resolve the `filter` input type name,
2) introspect that input type's fields and the product type's fields.
If introspection is disabled we'll see errors and pivot. Throwaway.
"""

from __future__ import annotations

import json
import os
import time

import requests

ENDPOINT = "https://app.scrapingbee.com/api/v1/"
GRAPHQL = "https://dutchie.com/graphql"
KEY = os.environ["SCRAPINGBEE_KEY"]


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def gql(query: str, tries: int = 6) -> dict | None:
    params = {
        "api_key": KEY, "url": GRAPHQL, "render_js": "false",
        "country_code": "us", "transparent_status_code": "true",
    }
    for i in range(tries):
        r = requests.post(ENDPOINT, params=params, json={"query": query},
                          headers={"Content-Type": "application/json"}, timeout=90)
        if r.status_code == 403:  # intermittent Cloudflare
            time.sleep(2 + i)
            continue
        try:
            return json.loads(r.text)
        except json.JSONDecodeError:
            emit(f"- non-JSON HTTP {r.status_code}: {r.text[:200]}")
            return None
    emit("- gave up after Cloudflare 403s")
    return None


def unwrap(t: dict) -> str:
    while t and t.get("ofType"):
        if t.get("name"):
            return t["name"]
        t = t["ofType"]
    return t.get("name") if t else None


def main() -> int:
    emit("# Dutchie GraphQL introspection (v5)")
    emit()

    # 1) filteredProducts args
    q1 = ('query { __type(name: "Query") { fields { name '
          'args { name type { kind name ofType { kind name ofType { kind name } } } } } } }')
    d1 = gql(q1)
    if not d1:
        return 0
    if "errors" in d1:
        emit("- introspection disabled or errored:")
        emit("```json")
        emit(json.dumps(d1["errors"], indent=2)[:800])
        emit("```")
        return 0

    fields = (((d1.get("data") or {}).get("__type") or {}).get("fields")) or []
    fp = next((f for f in fields if f["name"] == "filteredProducts"), None)
    if not fp:
        emit("- filteredProducts not found on Query. Sample fields: "
             + ", ".join(f["name"] for f in fields[:40]))
        return 0
    emit("## filteredProducts args")
    input_type_name = None
    for a in fp["args"]:
        tn = unwrap(a["type"])
        emit(f"- `{a['name']}`: {tn}")
        if a["name"] == "filter":
            input_type_name = tn
    emit()

    # 2) the filter input type's fields + the product type's fields
    def dump_type(name: str) -> None:
        q = ('query { __type(name: "%s") { name kind '
             'inputFields { name type { kind name ofType { kind name } } } '
             'fields { name type { kind name ofType { kind name } } } } }') % name
        d = gql(q)
        if not d or "errors" in (d or {}):
            emit(f"- could not introspect `{name}`: {json.dumps((d or {}).get('errors'))[:300]}")
            return
        t = (d.get("data") or {}).get("__type") or {}
        emit(f"## type `{name}` (kind {t.get('kind')})")
        for kind_key in ("inputFields", "fields"):
            items = t.get(kind_key) or []
            if items:
                emit(f"- {kind_key}:")
                emit("```")
                for it in items:
                    emit(f"  {it['name']}: {unwrap(it['type'])}")
                emit("```")

    if input_type_name:
        dump_type(input_type_name)
    dump_type("Products")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
