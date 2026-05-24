"""
Fetch 10-year daily P&L data for Nifty 50 constituents.
Saves one JSON per company + a manifest.json index.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
import time

import pandas as pd
import yfinance as yf

# Top 50 Indian companies (Nifty 50 constituents — Yahoo Finance NSE symbols)
NIFTY_50 = [
    ("RELIANCE",   "Reliance Industries",          "Energy"),
    ("TCS",        "Tata Consultancy Services",    "IT"),
    ("HDFCBANK",   "HDFC Bank",                    "Banks"),
    ("INFY",       "Infosys",                      "IT"),
    ("ICICIBANK",  "ICICI Bank",                   "Banks"),
    ("HINDUNILVR", "Hindustan Unilever",           "FMCG"),
    ("ITC",        "ITC",                          "FMCG"),
    ("SBIN",       "State Bank of India",          "Banks"),
    ("BHARTIARTL", "Bharti Airtel",                "Telecom"),
    ("KOTAKBANK",  "Kotak Mahindra Bank",          "Banks"),
    ("LT",         "Larsen & Toubro",              "Construction"),
    ("AXISBANK",   "Axis Bank",                    "Banks"),
    ("BAJFINANCE", "Bajaj Finance",                "Financial Services"),
    ("ASIANPAINT", "Asian Paints",                 "Consumer"),
    ("MARUTI",     "Maruti Suzuki",                "Auto"),
    ("HCLTECH",    "HCL Technologies",             "IT"),
    ("SUNPHARMA",  "Sun Pharmaceutical",           "Pharma"),
    ("TITAN",      "Titan Company",                "Consumer"),
    ("WIPRO",      "Wipro",                        "IT"),
    ("ULTRACEMCO", "UltraTech Cement",             "Cement"),
    ("NESTLEIND",  "Nestlé India",                 "FMCG"),
    ("M&M",        "Mahindra & Mahindra",          "Auto"),
    ("TATAMOTORS", "Tata Motors",                  "Auto"),
    ("NTPC",       "NTPC",                         "Power"),
    ("POWERGRID",  "Power Grid Corporation",       "Power"),
    ("TATASTEEL",  "Tata Steel",                   "Metals"),
    ("ADANIENT",   "Adani Enterprises",            "Conglomerate"),
    ("HDFCLIFE",   "HDFC Life Insurance",          "Insurance"),
    ("JSWSTEEL",   "JSW Steel",                    "Metals"),
    ("BAJAJFINSV", "Bajaj Finserv",                "Financial Services"),
    ("GRASIM",     "Grasim Industries",            "Cement"),
    ("ONGC",       "Oil & Natural Gas Corp",       "Energy"),
    ("BAJAJ-AUTO", "Bajaj Auto",                   "Auto"),
    ("BRITANNIA",  "Britannia Industries",         "FMCG"),
    ("SBILIFE",    "SBI Life Insurance",           "Insurance"),
    ("DIVISLAB",   "Divi's Laboratories",          "Pharma"),
    ("COALINDIA",  "Coal India",                   "Energy"),
    ("INDUSINDBK", "IndusInd Bank",                "Banks"),
    ("EICHERMOT",  "Eicher Motors",                "Auto"),
    ("DRREDDY",    "Dr. Reddy's Laboratories",     "Pharma"),
    ("CIPLA",      "Cipla",                        "Pharma"),
    ("HEROMOTOCO", "Hero MotoCorp",                "Auto"),
    ("APOLLOHOSP", "Apollo Hospitals",             "Healthcare"),
    ("TECHM",      "Tech Mahindra",                "IT"),
    ("HINDALCO",   "Hindalco Industries",          "Metals"),
    ("ADANIPORTS", "Adani Ports & SEZ",            "Infrastructure"),
    ("UPL",        "UPL",                          "Chemicals"),
    ("BPCL",       "Bharat Petroleum",             "Energy"),
    ("SHRIRAMFIN", "Shriram Finance",              "Financial Services"),
    ("LTIM",       "LTIMindtree",                  "IT"),
]

YEARS = 10
END = datetime.today()
START = END - timedelta(days=YEARS * 365 + 5)
OUT_DIR = Path("web/public/data/companies")


def fetch_one(ticker: str) -> pd.DataFrame:
    df = yf.download(f"{ticker}.NS", start=START, end=END, progress=False, auto_adjust=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.dropna(subset=["Open", "Close"]).copy()
    df["PrevClose"] = df["Close"].shift(1)
    df["DailyReturn%"] = ((df["Close"] - df["PrevClose"]) / df["PrevClose"]) * 100
    df["IntradayChange%"] = ((df["Close"] - df["Open"]) / df["Open"]) * 100
    df["Direction"] = df["DailyReturn%"].apply(
        lambda x: "Up" if x > 0 else ("Down" if x < 0 else "Flat")
    )
    df["Streak"] = (
        df.groupby((df["Direction"] != df["Direction"].shift()).cumsum()).cumcount() + 1
    )
    return df


def to_records(df: pd.DataFrame) -> list[dict]:
    records = []
    for date, row in df.iterrows():
        prev_close = float(row["PrevClose"]) if pd.notna(row["PrevClose"]) else None
        close_price = float(row["Close"])
        records.append({
            "date": date.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(close_price, 2),
            "prev_close": round(prev_close, 2) if prev_close is not None else None,
            "volume": int(row["Volume"]) if pd.notna(row["Volume"]) else None,
            "pnl_points": round(close_price - prev_close, 2) if prev_close is not None else None,
            "pnl_percent": round(float(row["DailyReturn%"]), 4) if pd.notna(row["DailyReturn%"]) else None,
            "intraday_change_percent": round(float(row["IntradayChange%"]), 4) if pd.notna(row["IntradayChange%"]) else None,
            "direction": row["Direction"],
            "streak": int(row["Streak"]),
        })
    return records


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    failed = []

    total = len(NIFTY_50)
    for i, (symbol, name, sector) in enumerate(NIFTY_50, 1):
        slug = symbol.replace("&", "AND")
        out_path = OUT_DIR / f"{slug}.json"
        print(f"[{i:>2}/{total}] {symbol:<12} {name}", end=" ", flush=True)
        try:
            df = fetch_one(symbol)
            if df.empty:
                print("✗ no data")
                failed.append(symbol)
                continue
            records = to_records(df)
            out_path.write_text(json.dumps(records))
            first = records[0]["date"]
            last = records[-1]["date"]
            manifest.append({
                "symbol": symbol,
                "slug": slug,
                "name": name,
                "sector": sector,
                "file": f"{slug}.json",
                "from": first,
                "to": last,
                "trading_days": len(records),
                "last_close": records[-1]["close"],
            })
            print(f"✓ {len(records)} days  ({first} → {last})")
        except Exception as e:
            print(f"✗ {e}")
            failed.append(symbol)
        # gentle pacing to avoid rate limiting
        time.sleep(0.3)

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nManifest saved: {len(manifest)} companies")
    if failed:
        print(f"Failed: {failed}")


if __name__ == "__main__":
    main()
