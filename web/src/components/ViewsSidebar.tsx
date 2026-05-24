"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useShell } from "./SidebarShell";

export default function ViewsSidebar() {
  const { rightOpen, setRightOpen } = useShell();
  const pathname = usePathname();
  const params = useParams<{ symbol?: string }>();
  const currentAsset = params?.symbol;

  // If we're on an asset page, preselect it as A in /compare
  const compareHref = currentAsset
    ? `/compare?a=${currentAsset}&b=${currentAsset === "NIFTY50" ? "SENSEX" : "NIFTY50"}`
    : "/compare";

  const mcHref = currentAsset
    ? `/montecarlo?asset=${currentAsset}`
    : "/montecarlo";

  const overviewActive = pathname?.startsWith("/assets");
  const compareActive = pathname?.startsWith("/compare");
  const mcActive = pathname?.startsWith("/montecarlo");
  const sectorsActive = pathname?.startsWith("/sectors");
  const corrActive = pathname?.startsWith("/correlations");

  if (!rightOpen) {
    return (
      <aside className="fixed right-0 top-0 h-screen w-10 bg-bg border-l border-border flex flex-col items-center pt-5 z-20">
        <button
          onClick={() => setRightOpen(true)}
          aria-label="Open views"
          className="text-text-faint hover:text-text p-2 rounded transition-colors"
          title="Views"
        >
          <ChevronLeft />
        </button>
        <div
          className="mt-4 text-[10px] tracking-[0.2em] text-text-faint uppercase"
          style={{ writingMode: "vertical-rl" }}
        >
          Views
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed right-0 top-0 h-screen w-60 bg-bg border-l border-border flex flex-col z-20">
      <div className="px-4 pt-5 pb-4 border-b border-border flex items-start justify-between">
        <div>
          <div className="text-[10px] tracking-[0.2em] text-text-faint uppercase">Views</div>
          <div className="text-sm font-medium text-text mt-0.5">Analyses</div>
        </div>
        <button
          onClick={() => setRightOpen(false)}
          aria-label="Collapse"
          className="text-text-faint hover:text-text p-1.5 rounded transition-colors mt-0.5"
          title="Collapse"
        >
          <ChevronRight />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ViewLink
          href={currentAsset ? `/assets/${currentAsset}` : "/assets"}
          active={!!overviewActive}
          label="Overview"
          hint="Stats & charts for the selected asset"
        />
        <ViewLink
          href={compareHref}
          active={!!compareActive}
          label="Compare"
          hint="Side-by-side analysis of two assets"
        />
        <ViewLink
          href={mcHref}
          active={!!mcActive}
          label="Monte Carlo"
          hint="Simulate plausible future price paths"
        />
        <ViewLink
          href="/sectors"
          active={!!sectorsActive}
          label="Sector Heatmap"
          hint="Returns by sector at a glance"
        />
        <ViewLink
          href="/correlations"
          active={!!corrActive}
          label="Correlation Matrix"
          hint="Pairwise return correlations across all assets"
        />

        <div className="px-4 mt-6 text-[10px] tracking-[0.18em] text-text-faint uppercase">
          Coming Soon
        </div>
        <ul className="mt-1">
          {["Backtest", "Drawdowns"].map((label) => (
            <li
              key={label}
              className="block px-4 py-1.5 text-[12px] text-text-faint border-l-2 border-transparent cursor-not-allowed"
              title="Not yet available"
            >
              {label}
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-4 py-3 border-t border-border text-[10px] text-text-faint">
        Views act on the asset selected in the left sidebar.
      </div>
    </aside>
  );
}

function ViewLink({
  href,
  active,
  label,
  hint,
}: {
  href: string;
  active: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className={`block px-4 py-2 border-l-2 transition-colors ${
        active
          ? "text-text bg-panel border-text"
          : "text-text-dim border-transparent hover:text-text hover:bg-panel hover:border-border-strong"
      }`}
    >
      <div className="text-[13px]">{label}</div>
      {hint && <div className="text-[10px] text-text-faint mt-0.5">{hint}</div>}
    </Link>
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
