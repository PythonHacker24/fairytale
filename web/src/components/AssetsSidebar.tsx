"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadAssetManifest } from "@/lib/data";
import type { AssetMeta } from "@/lib/types";
import { useShell } from "./SidebarShell";

export default function AssetsSidebar() {
  const { leftOpen, setLeftOpen } = useShell();
  const [assets, setAssets] = useState<AssetMeta[] | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const params = useParams<{ symbol?: string }>();
  const active = params?.symbol;

  useEffect(() => {
    loadAssetManifest().then(setAssets).catch(() => setAssets([]));
  }, []);

  const groups = useMemo(() => {
    if (!assets) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? assets.filter(
          (a) =>
            a.symbol.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
        )
      : assets;

    const indexFunds = filtered.filter((a) => a.type === "index");
    const stocks = filtered.filter((a) => a.type === "stock");

    const stockMap = new Map<string, AssetMeta[]>();
    for (const s of stocks) {
      const list = stockMap.get(s.category) ?? [];
      list.push(s);
      stockMap.set(s.category, list);
    }
    const stockGroups = [...stockMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const out: Array<[string, AssetMeta[]]> = [];
    if (indexFunds.length) out.push(["Index Funds", indexFunds]);
    return out.concat(stockGroups);
  }, [assets, query]);

  if (!leftOpen) {
    return (
      <aside className="fixed left-0 top-0 h-screen w-10 bg-bg border-r border-border flex flex-col items-center pt-5 z-20">
        <button
          onClick={() => setLeftOpen(true)}
          aria-label="Open sidebar"
          className="text-text-faint hover:text-text p-2 rounded transition-colors"
          title="fairytale · Stocks & Indexes"
        >
          <PhiLogo />
        </button>
        <div
          className="mt-4 text-[10px] tracking-[0.2em] text-text-faint uppercase"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Stocks & Indexes
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-bg border-r border-border flex flex-col z-20">
      <div className="px-4 pt-5 pb-4 border-b border-border flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <PhiLogo />
            <div className="text-lg font-bold tracking-wide text-text">fairytale</div>
          </div>
          <div className="text-[10px] text-text-faint mt-1 ml-0.5">Stocks &amp; Indexes · 10-year daily data</div>
        </div>
        <button
          onClick={() => setLeftOpen(false)}
          aria-label="Collapse"
          className="text-text-faint hover:text-text p-1.5 rounded transition-colors mt-0.5"
          title="Collapse"
        >
          <ChevronLeft />
        </button>
      </div>
      <div className="px-4 py-3 border-b border-border">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full bg-panel border border-border rounded px-3 py-1.5 text-[12px] text-text placeholder:text-text-faint focus:outline-none focus:border-border-strong"
        />
      </div>
      <nav className="flex-1 overflow-y-auto pb-4">
        {!assets && <div className="px-4 py-6 text-xs text-text-faint">Loading…</div>}
        {assets && assets.length === 0 && (
          <div className="px-4 py-6 text-xs text-text-faint">No assets yet.</div>
        )}
        {groups.map(([category, list]) => {
          const isCollapsed = collapsed[category];
          return (
            <div key={category} className="mt-3">
              <button
                onClick={() => setCollapsed((s) => ({ ...s, [category]: !s[category] }))}
                className="w-full px-4 flex items-center justify-between text-[10px] tracking-[0.18em] text-text-faint uppercase hover:text-text-dim"
              >
                <span>{category}</span>
                <span className="text-text-faint">{list.length}</span>
              </button>
              {!isCollapsed && (
                <ul className="mt-1">
                  {list.map((a) => {
                    const isActive = a.slug === active;
                    return (
                      <li key={a.slug}>
                        <Link
                          href={`/assets/${a.slug}`}
                          className={`block px-4 py-1.5 text-[12px] border-l-2 transition-colors ${
                            isActive
                              ? "text-text bg-panel border-text"
                              : "text-text-dim border-transparent hover:text-text hover:bg-panel hover:border-border-strong"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate">{a.name}</span>
                            <span className="text-[10px] text-text-faint tabular-nums shrink-0">
                              {a.symbol}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function PhiLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text">
      {/* Phi: vertical stroke + ellipse */}
      <line x1="12" y1="3" x2="12" y2="21" />
      <ellipse cx="12" cy="12" rx="4.5" ry="4" />
      {/* Top-right sparkle */}
      <line x1="19" y1="4" x2="19" y2="7" />
      <line x1="17.5" y1="5.5" x2="20.5" y2="5.5" />
      {/* Bottom-left sparkle (smaller) */}
      <line x1="5" y1="18" x2="5" y2="20" />
      <line x1="4" y1="19" x2="6" y2="19" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
