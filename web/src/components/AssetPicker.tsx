"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetMeta } from "@/lib/types";

type Props = {
  assets: AssetMeta[];
  value: string;
  onChange: (slug: string) => void;
  label: string;
  color: string; // accent color for the swatch
  disabled?: string; // slug to exclude
};

export default function AssetPicker({ assets, value, onChange, label, color, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = assets.find((a) => a.slug === value);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? assets.filter(
          (a) =>
            a.symbol.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
        )
      : assets;
    const indexFunds = list.filter((a) => a.type === "index");
    const stocks = list.filter((a) => a.type === "stock");
    const stockMap = new Map<string, AssetMeta[]>();
    for (const s of stocks) {
      const cur = stockMap.get(s.category) ?? [];
      cur.push(s);
      stockMap.set(s.category, cur);
    }
    const stockGroups = [...stockMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const out: Array<[string, AssetMeta[]]> = [];
    if (indexFunds.length) out.push(["Index Funds", indexFunds]);
    return out.concat(stockGroups);
  }, [assets, query]);

  return (
    <div ref={rootRef} className="relative flex-1 min-w-[200px]">
      <div className="text-[10px] tracking-[0.2em] text-text-faint uppercase mb-1.5 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full bg-panel border rounded px-3 py-2 text-left text-sm transition-colors flex items-baseline justify-between gap-3 ${
          open ? "border-border-strong" : "border-border hover:border-border-strong"
        }`}
      >
        <span className="truncate text-text">{current?.name ?? "Select…"}</span>
        <span className="text-[11px] text-text-faint tabular-nums shrink-0">{current?.symbol}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-[420px] overflow-hidden bg-panel border border-border-strong rounded shadow-lg flex flex-col">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="bg-panel-2 border-b border-border px-3 py-2 text-[12px] text-text placeholder:text-text-faint focus:outline-none"
          />
          <div className="flex-1 overflow-y-auto py-1">
            {groups.length === 0 && (
              <div className="px-3 py-4 text-xs text-text-faint">No matches.</div>
            )}
            {groups.map(([category, list]) => (
              <div key={category}>
                <div className="px-3 pt-2 pb-1 text-[10px] tracking-[0.18em] text-text-faint uppercase">
                  {category}
                </div>
                {list.map((a) => {
                  const isDisabled = a.slug === disabled;
                  const isActive = a.slug === value;
                  return (
                    <button
                      key={a.slug}
                      disabled={isDisabled}
                      onClick={() => {
                        onChange(a.slug);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 flex items-baseline justify-between gap-3 text-[12px] text-left ${
                        isDisabled
                          ? "text-text-faint cursor-not-allowed opacity-50"
                          : isActive
                          ? "text-text bg-panel-2"
                          : "text-text-dim hover:text-text hover:bg-panel-2"
                      }`}
                    >
                      <span className="truncate">{a.name}</span>
                      <span className="text-[10px] text-text-faint tabular-nums shrink-0">
                        {a.symbol}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
