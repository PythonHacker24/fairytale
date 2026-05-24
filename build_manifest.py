"""Build a unified assets manifest: indexes + stocks."""
import json
from pathlib import Path

ASSETS = Path("web/public/data/assets")

# Indexes (shown first)
INDEXES = [
    ("NIFTY50", "Nifty 50", "Index Funds"),
    ("SENSEX",  "Sensex",   "Index Funds"),
]

# Reuse stock metadata from fetch_companies
from fetch_companies import NIFTY_50

manifest = []
for slug, name, category in INDEXES:
    data = json.loads((ASSETS / f"{slug}.json").read_text())
    manifest.append({
        "symbol": slug,
        "slug": slug,
        "name": name,
        "type": "index",
        "category": category,
        "file": f"{slug}.json",
        "from": data[0]["date"],
        "to": data[-1]["date"],
        "trading_days": len(data),
        "last_close": data[-1]["close"],
    })

for symbol, name, sector in NIFTY_50:
    slug = symbol.replace("&", "AND")
    p = ASSETS / f"{slug}.json"
    if not p.exists():
        continue
    data = json.loads(p.read_text())
    manifest.append({
        "symbol": symbol,
        "slug": slug,
        "name": name,
        "type": "stock",
        "category": sector,
        "file": f"{slug}.json",
        "from": data[0]["date"],
        "to": data[-1]["date"],
        "trading_days": len(data),
        "last_close": data[-1]["close"],
    })

(ASSETS / "manifest.json").write_text(json.dumps(manifest, indent=2))
print(f"Wrote manifest with {len(manifest)} entries "
      f"({sum(1 for m in manifest if m['type']=='index')} indexes, "
      f"{sum(1 for m in manifest if m['type']=='stock')} stocks)")
