import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { loadAssetManifest } from "@/lib/data";
import type { AssetMeta } from "@/lib/types";

export const revalidate = 300;

export default async function AssetsIndex() {
  const assets = await loadAssetManifest();
  const byCategory = new Map<string, AssetMeta[]>();
  for (const a of assets) {
    const list = byCategory.get(a.category) ?? [];
    list.push(a);
    byCategory.set(a.category, list);
  }
  const indexFunds = byCategory.get("Index Funds") ?? [];
  const sectors = [...byCategory.entries()]
    .filter(([cat]) => cat !== "Index Funds")
    .sort((a, b) => a[0].localeCompare(b[0]));
  const ordered: Array<[string, AssetMeta[]]> = indexFunds.length
    ? [["Index Funds", indexFunds], ...sectors]
    : sectors;

  return (
    <>
      <PageHeader
        title="Stocks & Indexes"
        subtitle={`${assets.length} assets · 10-year daily data`}
        meta="Pick one from the sidebar or below"
      />
      <div className="p-10 space-y-8">
        {ordered.map(([category, list]) => (
          <section key={category}>
            <div className="text-[11px] tracking-[0.2em] text-text-faint uppercase mb-3">
              {category} · {list.length}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {list.map((a) => (
                <Link
                  key={a.slug}
                  href={`/assets/${a.slug}`}
                  className="bg-panel border border-border rounded-lg p-4 hover:border-border-strong transition-colors"
                >
                  <div className="text-sm font-medium text-text truncate">{a.name}</div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-[11px] text-text-faint tabular-nums">{a.symbol}</span>
                    <span className="text-[11px] text-text-dim tabular-nums">
                      {a.type === "stock" ? "₹" : ""}
                      {a.last_close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-faint mt-1 tabular-nums">
                    {a.trading_days} days
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
