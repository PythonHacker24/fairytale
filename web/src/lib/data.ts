import { supabase } from "./supabase";
import type {
  DailyRecord,
  AssetMeta,
  SectorRow,
  PeriodKey,
  CorrPeriod,
  CorrPair,
} from "./types";

const cache = new Map<string, unknown>();

export async function loadAssetManifest(): Promise<AssetMeta[]> {
  const key = "manifest";
  if (cache.has(key)) return cache.get(key) as AssetMeta[];

  const { data, error } = await supabase
    .from("asset_overview")
    .select("id, symbol, slug, name, type, category, first_date, last_date, trading_days, last_close")
    .order("type", { ascending: true }) // 'index' before 'stock'
    .order("category", { ascending: true })
    .order("symbol", { ascending: true });

  if (error) throw new Error(`Failed to load manifest: ${error.message}`);

  const manifest: AssetMeta[] = (data ?? []).map((r) => ({
    id: r.id,
    symbol: r.symbol,
    slug: r.slug,
    name: r.name,
    type: r.type as AssetMeta["type"],
    category: r.category,
    file: `${r.slug}.json`, // legacy field, no longer used by readers
    from: r.first_date,
    to: r.last_date,
    trading_days: r.trading_days,
    last_close: Number(r.last_close),
  }));

  cache.set(key, manifest);
  return manifest;
}

export async function loadAssetDaily(slug: string): Promise<DailyRecord[]> {
  const cacheKey = `bars:${slug}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) as DailyRecord[];

  const { data: asset, error: assetErr } = await supabase
    .from("assets")
    .select("id")
    .eq("slug", slug)
    .single();
  if (assetErr || !asset) {
    throw new Error(`Unknown asset slug "${slug}": ${assetErr?.message ?? "not found"}`);
  }

  const rows = await fetchAllBars(asset.id);
  const bars = rows.map(toDailyRecord);
  attachStreaks(bars);

  cache.set(cacheKey, bars);
  return bars;
}

// Supabase's PostgREST caps responses at 1000 rows by default. 10y of daily
// bars is ~2500, so we paginate. Three round trips per asset, fully cached.
async function fetchAllBars(assetId: number): Promise<EnrichedRow[]> {
  const PAGE = 1000;
  const all: EnrichedRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("prices_enriched")
      .select(
        "date, open, high, low, close, prev_close, volume, daily_return_pct, intraday_change_pct, direction"
      )
      .eq("asset_id", assetId)
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Failed to load bars: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as EnrichedRow[]));
    if (data.length < PAGE) break;
  }
  return all;
}

type EnrichedRow = {
  date: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  prev_close: string | number | null;
  volume: number | null;
  daily_return_pct: string | number | null;
  intraday_change_pct: string | number | null;
  direction: "Up" | "Down" | "Flat" | null;
};

function toDailyRecord(r: EnrichedRow): DailyRecord {
  const close = Number(r.close);
  const prevClose = r.prev_close === null ? null : Number(r.prev_close);
  const pnlPct = r.daily_return_pct === null ? null : Number(r.daily_return_pct);
  const intradayPct = r.intraday_change_pct === null ? null : Number(r.intraday_change_pct);
  return {
    date: r.date,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close,
    prev_close: prevClose,
    volume: r.volume,
    pnl_points: prevClose === null ? null : close - prevClose,
    pnl_percent: pnlPct,
    intraday_change_percent: intradayPct,
    direction: r.direction ?? "Flat",
    streak: 1,
  };
}

export async function loadSectorReturns(): Promise<SectorRow[]> {
  const cacheKey = "sector-returns";
  if (cache.has(cacheKey)) return cache.get(cacheKey) as SectorRow[];

  // Single join: pull metadata + returns in one round trip.
  // PostgREST embeds via FK; asset_returns has FK-eligible asset_id.
  const { data, error } = await supabase
    .from("assets")
    .select(
      "symbol, slug, name, category, type, asset_returns(last_close, ret_1d, ret_1w, ret_1m, ret_3m, ret_ytd, ret_1y, ret_5y, ret_all)"
    )
    .order("category")
    .order("symbol");

  if (error) throw new Error(`Failed to load sector returns: ${error.message}`);

  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);

  type Joined = {
    symbol: string;
    slug: string;
    name: string;
    category: string;
    type: "index" | "stock";
    asset_returns:
      | {
          last_close: string | number | null;
          ret_1d: string | number | null;
          ret_1w: string | number | null;
          ret_1m: string | number | null;
          ret_3m: string | number | null;
          ret_ytd: string | number | null;
          ret_1y: string | number | null;
          ret_5y: string | number | null;
          ret_all: string | number | null;
        }
      | Array<{
          last_close: string | number | null;
          ret_1d: string | number | null;
          ret_1w: string | number | null;
          ret_1m: string | number | null;
          ret_3m: string | number | null;
          ret_ytd: string | number | null;
          ret_1y: string | number | null;
          ret_5y: string | number | null;
          ret_all: string | number | null;
        }>
      | null;
  };

  const rows: SectorRow[] = (data as Joined[] | null ?? []).map((r) => {
    const ar = Array.isArray(r.asset_returns) ? r.asset_returns[0] : r.asset_returns;
    const returns: Record<PeriodKey, number | null> = {
      "1D":  num(ar?.ret_1d),
      "1W":  num(ar?.ret_1w),
      "1M":  num(ar?.ret_1m),
      "3M":  num(ar?.ret_3m),
      "YTD": num(ar?.ret_ytd),
      "1Y":  num(ar?.ret_1y),
      "5Y":  num(ar?.ret_5y),
      "All": num(ar?.ret_all),
    };
    return {
      symbol: r.symbol,
      slug: r.slug,
      name: r.name,
      category: r.category,
      type: r.type,
      last_close: Number(ar?.last_close ?? 0),
      returns,
    };
  });

  cache.set(cacheKey, rows);
  return rows;
}

const PERIOD_MONTHS: Record<CorrPeriod, number | null> = {
  "1Y": 12,
  "3Y": 36,
  "5Y": 60,
  "All": null,
};

export async function loadCorrelations(period: CorrPeriod): Promise<CorrPair[]> {
  const cacheKey = `corr:${period}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) as CorrPair[];

  // PostgREST caps RPC table responses at 1000 rows. 50 assets = 1225 pairs,
  // so paginate via Range header on the RPC call.
  type Row = { a_id: number; b_id: number; n_obs: number; corr_val: string | number | null };
  const PAGE = 1000;
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .rpc("asset_correlations", { p_months: PERIOD_MONTHS[period] })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load correlations: ${error.message}`);
    const rows = (data as Row[] | null) ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }

  const pairs: CorrPair[] = all
    .filter((r) => r.corr_val !== null)
    .map((r) => ({
      a_id: r.a_id,
      b_id: r.b_id,
      n: r.n_obs,
      corr: Number(r.corr_val),
    }));

  cache.set(cacheKey, pairs);
  return pairs;
}

function attachStreaks(bars: DailyRecord[]): void {
  let streak = 0;
  let prevDir: DailyRecord["direction"] | null = null;
  for (const bar of bars) {
    streak = bar.direction === prevDir ? streak + 1 : 1;
    bar.streak = streak;
    prevDir = bar.direction;
  }
}
