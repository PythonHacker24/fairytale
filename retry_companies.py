"""Retry failed tickers with backoff + longer pacing."""
import json
import time
from pathlib import Path

from fetch_companies import NIFTY_50, fetch_one, to_records, OUT_DIR

FAILED = ["TATAMOTORS", "DRREDDY", "CIPLA", "HEROMOTOCO", "APOLLOHOSP",
          "TECHM", "HINDALCO", "ADANIPORTS", "UPL", "BPCL", "SHRIRAMFIN", "LTIM"]

meta_by_symbol = {sym: (name, sector) for sym, name, sector in NIFTY_50}

manifest_path = OUT_DIR / "manifest.json"
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
existing = {m["symbol"] for m in manifest}

still_failed = []
for symbol in FAILED:
    if symbol in existing:
        continue
    name, sector = meta_by_symbol[symbol]
    slug = symbol.replace("&", "AND")
    out_path = OUT_DIR / f"{slug}.json"

    for attempt in range(1, 4):
        try:
            print(f"{symbol:<12} attempt {attempt} ...", end=" ", flush=True)
            df = fetch_one(symbol)
            if df.empty:
                print("empty")
                break
            records = to_records(df)
            out_path.write_text(json.dumps(records))
            manifest.append({
                "symbol": symbol, "slug": slug, "name": name, "sector": sector,
                "file": f"{slug}.json",
                "from": records[0]["date"], "to": records[-1]["date"],
                "trading_days": len(records),
                "last_close": records[-1]["close"],
            })
            print(f"✓ {len(records)} days")
            break
        except Exception as e:
            print(f"✗ {e}")
            time.sleep(5 * attempt)
    else:
        still_failed.append(symbol)
    time.sleep(2.0)  # gentle pacing

manifest.sort(key=lambda m: [s for s, _, _ in NIFTY_50].index(m["symbol"]))
manifest_path.write_text(json.dumps(manifest, indent=2))
print(f"\nManifest now has {len(manifest)} companies")
if still_failed:
    print(f"Still failing: {still_failed}")
