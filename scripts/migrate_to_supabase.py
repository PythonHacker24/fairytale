"""Migrate the 10-year OHLCV data into Supabase.

Run AFTER applying supabase/schema.sql in the Supabase dashboard SQL editor.

    python scripts/migrate_to_supabase.py
    python scripts/migrate_to_supabase.py --truncate   # wipe and reload

Reads:  web/public/data/assets/{manifest.json, <SYMBOL>.json}
Writes: public.assets, public.prices  (via Supabase REST + service role key)

Stdlib only. No supabase-py dependency.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "web" / "public" / "data" / "assets"
MANIFEST = ASSETS_DIR / "manifest.json"

BATCH_SIZE = 1000  # rows per POST to /rest/v1/prices


def load_env() -> tuple[str, str]:
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env)")
    return url.rstrip("/"), key


def request(
    method: str,
    url: str,
    key: str,
    *,
    body: Any = None,
    prefer: str | None = None,
    query: dict[str, str] | None = None,
) -> Any:
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer

    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = resp.read().decode("utf-8")
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} on {method} {url}\n{e.read().decode('utf-8', 'replace')}")


def truncate(url: str, key: str) -> None:
    # DELETE everything. PostgREST requires a filter; date >= 1900 matches all.
    print("  · clearing prices...")
    request("DELETE", f"{url}/rest/v1/prices", key, query={"date": "gte.1900-01-01"})
    print("  · clearing assets...")
    request("DELETE", f"{url}/rest/v1/assets", key, query={"id": "gte.0"})


def upsert_assets(url: str, key: str, manifest: list[dict]) -> dict[str, int]:
    """Upsert assets, return symbol -> id map."""
    rows = [
        {
            "symbol": m["symbol"],
            "slug": m["slug"],
            "name": m["name"],
            "type": m["type"],
            "category": m["category"],
        }
        for m in manifest
    ]
    inserted = request(
        "POST",
        f"{url}/rest/v1/assets",
        key,
        body=rows,
        prefer="return=representation,resolution=merge-duplicates",
    )
    return {row["symbol"]: row["id"] for row in inserted}


def load_bars(slug: str) -> list[dict]:
    path = ASSETS_DIR / f"{slug}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def to_price_rows(asset_id: int, bars: list[dict]) -> list[dict]:
    rows = []
    for b in bars:
        rows.append(
            {
                "asset_id": asset_id,
                "date": b["date"],
                "open": b["open"],
                "high": b["high"],
                "low": b["low"],
                "close": b["close"],
                "volume": b.get("volume"),
            }
        )
    return rows


def insert_prices(url: str, key: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        request(
            "POST",
            f"{url}/rest/v1/prices",
            key,
            body=batch,
            prefer="return=minimal,resolution=merge-duplicates",
        )


def count(url: str, key: str, table: str) -> int:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Prefer": "count=exact",
        "Range-Unit": "items",
        "Range": "0-0",
    }
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}?select=*", headers=headers, method="HEAD"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        cr = resp.headers.get("Content-Range", "")
    # Content-Range: "0-0/12345" or "*/12345"
    return int(cr.rsplit("/", 1)[-1]) if "/" in cr else 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--truncate", action="store_true", help="wipe tables before loading")
    args = ap.parse_args()

    url, key = load_env()
    if not MANIFEST.exists():
        sys.exit(f"manifest not found: {MANIFEST}")

    manifest = json.loads(MANIFEST.read_text())
    print(f"loaded manifest: {len(manifest)} assets")

    if args.truncate:
        print("truncating existing tables...")
        truncate(url, key)

    print("upserting assets...")
    symbol_to_id = upsert_assets(url, key, manifest)
    print(f"  · {len(symbol_to_id)} assets in db")

    print("inserting prices...")
    t0 = time.time()
    total = 0
    for m in manifest:
        asset_id = symbol_to_id[m["symbol"]]
        bars = load_bars(m["slug"])
        rows = to_price_rows(asset_id, bars)
        insert_prices(url, key, rows)
        total += len(rows)
        print(f"  · {m['symbol']:<12} {len(rows):>5} rows  (cum {total})")

    dt = time.time() - t0
    print(f"done: {total} price rows in {dt:.1f}s")

    print("verifying...")
    a = count(url, key, "assets")
    p = count(url, key, "prices")
    print(f"  · assets: {a}")
    print(f"  · prices: {p}")
    if a != len(manifest) or p != total:
        sys.exit(f"row count mismatch (expected assets={len(manifest)}, prices={total})")
    print("ok")


if __name__ == "__main__":
    main()
