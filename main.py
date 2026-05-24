"""
Indian Market 10-Year Up/Down Analysis
Pulls Nifty 50 and Sensex daily data, flags up/down days,
computes returns, streaks, and summary stats.
Outputs per-day P&L JSON + summary JSON.
"""

import json
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

# ---------- CONFIG ----------
TICKERS = {
    "Nifty50": "^NSEI",
    "Sensex": "^BSESN",
}
YEARS = 10
END = datetime.today()
START = END - timedelta(days=YEARS * 365 + 5)
OUT_DIR = Path("output")
# ----------------------------


def fetch(ticker: str) -> pd.DataFrame:
    df = yf.download(ticker, start=START, end=END, progress=False, auto_adjust=False)

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
        df.groupby((df["Direction"] != df["Direction"].shift()).cumsum())
        .cumcount() + 1
    )

    return df


def to_daily_json(df: pd.DataFrame) -> list[dict]:
    """Convert each row to a P&L record."""
    records = []
    for date, row in df.iterrows():
        open_price = float(row["Open"])
        close_price = float(row["Close"])
        prev_close = float(row["PrevClose"]) if pd.notna(row["PrevClose"]) else None

        daily_return = float(row["DailyReturn%"]) if pd.notna(row["DailyReturn%"]) else None
        pnl_points = round(close_price - prev_close, 2) if prev_close is not None else None

        records.append({
            "date": date.strftime("%Y-%m-%d"),
            "open": round(open_price, 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(close_price, 2),
            "prev_close": round(prev_close, 2) if prev_close is not None else None,
            "volume": int(row["Volume"]) if pd.notna(row["Volume"]) else None,
            "pnl_points": pnl_points,
            "pnl_percent": round(daily_return, 4) if daily_return is not None else None,
            "intraday_change_percent": round(float(row["IntradayChange%"]), 4) if pd.notna(row["IntradayChange%"]) else None,
            "direction": row["Direction"],
            "streak": int(row["Streak"]),
        })
    return records


def summarize(df: pd.DataFrame, name: str) -> dict:
    counts = df["Direction"].value_counts()
    up_days = int(counts.get("Up", 0))
    down_days = int(counts.get("Down", 0))
    flat_days = int(counts.get("Flat", 0))
    total = up_days + down_days

    up_mask = df["Direction"] == "Up"
    down_mask = df["Direction"] == "Down"
    longest_up = int(df.loc[up_mask, "Streak"].max()) if up_mask.any() else 0
    longest_down = int(df.loc[down_mask, "Streak"].max()) if down_mask.any() else 0

    best_idx = df["DailyReturn%"].idxmax()
    worst_idx = df["DailyReturn%"].idxmin()

    return {
        "index": name,
        "from": df.index.min().strftime("%Y-%m-%d"),
        "to": df.index.max().strftime("%Y-%m-%d"),
        "total_trading_days": len(df),
        "up_days": up_days,
        "down_days": down_days,
        "flat_days": flat_days,
        "up_percent": round(up_days / total * 100, 2) if total else 0,
        "avg_daily_return_percent": round(float(df["DailyReturn%"].mean()), 4),
        "best_day": {
            "date": best_idx.strftime("%Y-%m-%d"),
            "return_percent": round(float(df.loc[best_idx, "DailyReturn%"]), 4),
        },
        "worst_day": {
            "date": worst_idx.strftime("%Y-%m-%d"),
            "return_percent": round(float(df.loc[worst_idx, "DailyReturn%"]), 4),
        },
        "volatility_std_percent": round(float(df["DailyReturn%"].std()), 4),
        "longest_up_streak": longest_up,
        "longest_down_streak": longest_down,
    }


def main():
    OUT_DIR.mkdir(exist_ok=True)
    all_summaries = []

    for name, ticker in TICKERS.items():
        print(f"Fetching {name} ({ticker})...")
        df = fetch(ticker)
        print(f"  {len(df)} trading days from {df.index.min().date()} to {df.index.max().date()}")

        daily = to_daily_json(df)
        daily_path = OUT_DIR / f"{name}_daily_pnl.json"
        daily_path.write_text(json.dumps(daily, indent=2))
        print(f"  saved -> {daily_path}")

        summary = summarize(df, name)
        all_summaries.append(summary)

    summary_path = OUT_DIR / "summary.json"
    summary_path.write_text(json.dumps(all_summaries, indent=2))
    print(f"\nsaved -> {summary_path}")

    print("\n=== SUMMARY ===")
    for s in all_summaries:
        print(f"\n{s['index']} ({s['from']} → {s['to']})")
        print(f"  Trading days : {s['total_trading_days']}")
        print(f"  Up / Down    : {s['up_days']} / {s['down_days']}  ({s['up_percent']}% up)")
        print(f"  Avg return   : {s['avg_daily_return_percent']}%")
        print(f"  Best day     : {s['best_day']['date']}  +{s['best_day']['return_percent']}%")
        print(f"  Worst day    : {s['worst_day']['date']}  {s['worst_day']['return_percent']}%")
        print(f"  Volatility   : {s['volatility_std_percent']}%  std")
        print(f"  Longest up streak  : {s['longest_up_streak']} days")
        print(f"  Longest down streak: {s['longest_down_streak']} days")


if __name__ == "__main__":
    main()
