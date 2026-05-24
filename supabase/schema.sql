-- fairytale: schema for 10-year Indian equities OHLCV data.
--
-- Design notes:
--   * Two base tables: assets (metadata, ~50 rows) and prices (raw OHLCV, ~125k rows).
--   * Composite PK (asset_id, date) on prices clusters bars by asset chronologically,
--     which is the natural order for every read path (single-asset history, return
--     series sampling, drawdown scans).
--   * Secondary index on (date) supports cross-asset date-aligned joins (Compare:
--     correlation, beta) without re-scanning per asset.
--   * numeric(16, 4) for prices: exact decimal, no float64 drift in aggregates.
--   * Derived fields (prev_close, daily_return_pct, intraday_change_pct, direction)
--     live in a VIEW, not a column. Window functions over ~2.5k rows per asset are
--     instant, and the values can never disagree with the underlying OHLCV.
--   * RLS: anon role gets read-only access; writes require the service role.

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id         smallserial primary key,
  symbol     text not null unique,
  slug       text not null unique,
  name       text not null,
  type       text not null check (type in ('index', 'stock')),
  category   text not null,
  created_at timestamptz not null default now()
);

create index if not exists assets_type_category_idx
  on public.assets (type, category);

comment on table public.assets is
  'Tradeable instruments tracked by fairytale (indexes and Nifty 50 constituents).';

-- ---------------------------------------------------------------------------
-- prices (raw OHLCV)
-- ---------------------------------------------------------------------------
create table if not exists public.prices (
  asset_id smallint     not null references public.assets(id) on delete cascade,
  date     date         not null,
  open     numeric(16, 4) not null,
  high     numeric(16, 4) not null,
  low      numeric(16, 4) not null,
  close    numeric(16, 4) not null,
  volume   bigint,
  primary key (asset_id, date)
);

create index if not exists prices_date_idx on public.prices (date);

comment on table public.prices is
  'Daily OHLCV bars. Derived metrics (returns, direction) live in prices_enriched.';

-- ---------------------------------------------------------------------------
-- prices_enriched: OHLCV + derived fields via window functions.
-- ---------------------------------------------------------------------------
create or replace view public.prices_enriched as
select
  p.asset_id,
  p.date,
  p.open,
  p.high,
  p.low,
  p.close,
  p.volume,
  lag(p.close) over w as prev_close,
  case
    when lag(p.close) over w is null then null
    else round(
      ((p.close - lag(p.close) over w) / lag(p.close) over w * 100)::numeric,
      6
    )
  end as daily_return_pct,
  round(((p.close - p.open) / nullif(p.open, 0) * 100)::numeric, 6)
    as intraday_change_pct,
  case
    when lag(p.close) over w is null then null
    when p.close > lag(p.close) over w then 'Up'
    when p.close < lag(p.close) over w then 'Down'
    else 'Flat'
  end as direction
from public.prices p
window w as (partition by p.asset_id order by p.date);

comment on view public.prices_enriched is
  'OHLCV plus derived returns and direction. Computed, not stored.';

-- ---------------------------------------------------------------------------
-- asset_latest: last close per asset (for sidebars / asset index pages).
-- ---------------------------------------------------------------------------
create or replace view public.asset_latest as
select distinct on (p.asset_id)
  p.asset_id,
  p.date as last_date,
  p.close as last_close
from public.prices p
order by p.asset_id, p.date desc;

-- ---------------------------------------------------------------------------
-- asset_overview: full manifest in one query (one row per asset with summary).
-- Replaces the JSON manifest the frontend used to load.
-- ---------------------------------------------------------------------------
create or replace view public.asset_overview as
select
  a.id,
  a.symbol,
  a.slug,
  a.name,
  a.type,
  a.category,
  agg.first_date,
  agg.last_date,
  agg.trading_days,
  l.last_close
from public.assets a
left join lateral (
  select min(p.date) as first_date,
         max(p.date) as last_date,
         count(*)     as trading_days
  from public.prices p
  where p.asset_id = a.id
) agg on true
left join public.asset_latest l on l.asset_id = a.id;

-- ---------------------------------------------------------------------------
-- asset_returns: one row per asset with returns over standard lookback periods.
-- Powers the Sector Heatmap. One round trip for the whole grid.
--
-- "Now" is anchored to each asset's latest available bar (not current_date),
-- so the view stays sensible even when the dataset goes stale.
--
-- Lookbacks are in trading days, not calendar days:
--   1W ≈ 5,   1M ≈ 21,   3M ≈ 63,   1Y ≈ 252,   5Y ≈ 1260.
-- The N-th prior close is the bar with rn_desc = N+1.
-- ---------------------------------------------------------------------------
create or replace view public.asset_returns as
with ranked as (
  select
    asset_id,
    date,
    close,
    row_number() over (partition by asset_id order by date desc) as rn_desc,
    row_number() over (partition by asset_id order by date asc)  as rn_asc,
    row_number() over (partition by asset_id, extract(year from date)
                       order by date asc)                        as rn_in_year
  from public.prices
),
agg as (
  select
    asset_id,
    max(close) filter (where rn_desc = 1)    as close_now,
    max(date)  filter (where rn_desc = 1)    as date_now,
    max(close) filter (where rn_desc = 2)    as close_1d,
    max(close) filter (where rn_desc = 6)    as close_1w,
    max(close) filter (where rn_desc = 22)   as close_1m,
    max(close) filter (where rn_desc = 64)   as close_3m,
    max(close) filter (where rn_desc = 253)  as close_1y,
    max(close) filter (where rn_desc = 1261) as close_5y,
    max(close) filter (where rn_asc  = 1)    as close_inception,
    max(extract(year from date)) filter (where rn_desc = 1) as latest_year
  from ranked
  group by asset_id
),
ytd as (
  select r.asset_id, r.close as close_ytd_start
  from ranked r
  join agg a on a.asset_id = r.asset_id
  where extract(year from r.date) = a.latest_year
    and r.rn_in_year = 1
)
select
  a.asset_id,
  a.close_now as last_close,
  a.date_now  as last_date,
  100 * (a.close_now / nullif(a.close_1d, 0)        - 1) as ret_1d,
  100 * (a.close_now / nullif(a.close_1w, 0)        - 1) as ret_1w,
  100 * (a.close_now / nullif(a.close_1m, 0)        - 1) as ret_1m,
  100 * (a.close_now / nullif(a.close_3m, 0)        - 1) as ret_3m,
  100 * (a.close_now / nullif(y.close_ytd_start, 0) - 1) as ret_ytd,
  100 * (a.close_now / nullif(a.close_1y, 0)        - 1) as ret_1y,
  100 * (a.close_now / nullif(a.close_5y, 0)        - 1) as ret_5y,
  100 * (a.close_now / nullif(a.close_inception, 0) - 1) as ret_all
from agg a
left join ytd y on y.asset_id = a.asset_id;

comment on view public.asset_returns is
  'Per-asset returns over standard lookback periods. Anchored to each asset''s last bar.';

-- ---------------------------------------------------------------------------
-- asset_correlations(p_months): pairwise Pearson correlation of daily returns
-- between every distinct pair of assets, restricted to the last p_months
-- calendar months (NULL = all time).
--
-- Returns the upper triangle only (a_id < b_id); the client mirrors for display.
-- Postgres corr() handles the math; the INNER JOIN aligns dates.
--
-- 50 assets → 1225 pairs. ~10y of bars. Runs in <1s on Supabase.
-- ---------------------------------------------------------------------------
create or replace function public.asset_correlations(p_months int default 12)
returns table (
  a_id     smallint,
  b_id     smallint,
  n_obs    int,
  corr_val numeric
)
language sql
stable
-- "All" time joins ~3M rows; override the default 3s anon timeout.
-- Requires SECURITY DEFINER for the timeout SET to actually take effect
-- (otherwise Supabase's role-level GUC wins). Function is read-only by design,
-- so escalated privilege is safe; pinned search_path prevents schema tricks.
security definer
set statement_timeout = '60s'
set search_path = public, pg_temp
as $$
  with bars as (
    select
      asset_id,
      date,
      daily_return_pct
    from public.prices_enriched
    where daily_return_pct is not null
      and (
        p_months is null
        or date >= (select max(date) - make_interval(months => p_months) from public.prices)
      )
  )
  select
    a.asset_id::smallint,
    b.asset_id::smallint,
    count(*)::int,
    corr(a.daily_return_pct, b.daily_return_pct)::numeric
  from bars a
  join bars b
    on a.date = b.date
   and a.asset_id < b.asset_id
  group by a.asset_id, b.asset_id;
$$;

comment on function public.asset_correlations(int) is
  'Pairwise daily-return correlations over a rolling N-month window. NULL = all time.';

-- Grant explicit execute (SECURITY DEFINER + anon role).
grant execute on function public.asset_correlations(int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: public read, no public write.
-- ---------------------------------------------------------------------------
alter table public.assets enable row level security;
alter table public.prices enable row level security;

drop policy if exists "Public read assets" on public.assets;
drop policy if exists "Public read prices" on public.prices;

create policy "Public read assets" on public.assets
  for select using (true);

create policy "Public read prices" on public.prices
  for select using (true);

-- Service role bypasses RLS automatically; no write policies needed.
