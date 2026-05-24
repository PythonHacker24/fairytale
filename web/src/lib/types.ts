export type DailyRecord = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prev_close: number | null;
  volume: number | null;
  pnl_points: number | null;
  pnl_percent: number | null;
  intraday_change_percent: number | null;
  direction: "Up" | "Down" | "Flat";
  streak: number;
};

export type Summary = {
  index: string;
  from: string;
  to: string;
  total_trading_days: number;
  up_days: number;
  down_days: number;
  flat_days: number;
  up_percent: number;
  avg_daily_return_percent: number;
  best_day: { date: string; return_percent: number };
  worst_day: { date: string; return_percent: number };
  volatility_std_percent: number;
  longest_up_streak: number;
  longest_down_streak: number;
};

export type IndexKey = "Nifty50" | "Sensex";

export type AssetType = "index" | "stock";

export type AssetMeta = {
  id: number;
  symbol: string;
  slug: string;
  name: string;
  type: AssetType;
  category: string;
  file: string;
  from: string;
  to: string;
  trading_days: number;
  last_close: number;
};

export type CorrPeriod = "1Y" | "3Y" | "5Y" | "All";

export type CorrPair = {
  a_id: number;
  b_id: number;
  n: number;
  corr: number;
};

export type PeriodKey = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "All";

export type SectorRow = {
  symbol: string;
  slug: string;
  name: string;
  category: string;
  type: "index" | "stock";
  last_close: number;
  returns: Record<PeriodKey, number | null>;
};

export type ComputedStats = {
  total: number;
  up: number;
  down: number;
  flat: number;
  upPercent: number;
  meanDaily: number;
  stdDaily: number;
  annualisedVol: number;
  cumulativeReturn: number;
  bestDay: { date: string; pct: number };
  worstDay: { date: string; pct: number };
  longestUpStreak: number;
  longestDownStreak: number;
  lastClose: number;
  firstClose: number;
};

