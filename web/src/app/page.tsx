import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-8 py-20">
        <div className="max-w-2xl w-full">
          <div className="flex flex-col items-center text-center">
            <PhiMark />
            <div className="mt-6 text-5xl font-bold tracking-tight text-text">
              fairytale
            </div>
            <div className="mt-3 text-sm text-text-dim">
              Modeling markets with mathematics
            </div>

            <p className="mt-10 text-[15px] leading-relaxed text-text-dim max-w-lg">
              A research workspace for studying Indian equities through a
              statistical lens. Ten years of daily data on the Nifty 50, Sensex,
              and the stocks that compose them, turned into distributions,
              correlations, and simulated futures.
            </p>

            <Link
              href="/assets/NIFTY50"
              className="mt-10 inline-flex items-center gap-2 bg-text text-bg px-5 py-2.5 rounded text-sm font-medium hover:bg-text/90 transition-colors"
            >
              Enter the workspace
              <ArrowRight />
            </Link>
            <div className="mt-3 text-[11px] text-text-faint">
              For learning and research · not investment advice
            </div>
          </div>

          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-3">
            <ConceptCard
              label="01 · Describe"
              title="Overview"
              body="Returns, volatility, drawdowns, and the shape of daily moves. The descriptive statistics of an asset's behavior."
              href="/assets/NIFTY50"
            />
            <ConceptCard
              label="02 · Relate"
              title="Compare"
              body="Two series side by side. Correlation, beta, and how one asset's risk decomposes against another."
              href="/compare"
            />
            <ConceptCard
              label="03 · Project"
              title="Monte Carlo"
              body="Sample thousands of plausible futures from the historical distribution. Read uncertainty as a fan, not a forecast."
              href="/montecarlo"
            />
          </div>
        </div>
      </div>

      <footer className="border-t border-border px-8 py-8">
        <div className="max-w-3xl mx-auto text-[11px] text-text-faint leading-relaxed space-y-3">
          <div className="tracking-[0.2em] uppercase text-text-dim">Disclaimer</div>
          <p>
            fairytale is a personal research and learning project. Nothing on
            this site is investment advice. It is not affiliated with any
            brokerage, exchange, custodian, advisor, or financial institution.
          </p>
          <p>
            Market data is sourced from Yahoo Finance via yfinance and may be
            incomplete, delayed, stale, adjusted differently than you expect,
            or simply wrong. No warranty is made as to accuracy, completeness,
            or timeliness, and the site may stop being updated at any time.
            Past performance does not predict future returns. Any decision you
            make based on anything shown here is entirely your own
            responsibility.
          </p>
          <div className="flex items-center justify-between pt-3 text-text-faint">
            <div>fairytale · Indian Markets</div>
            <div className="font-mono">Φ</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PhiMark() {
  return (
    <div className="w-20 h-20 rounded-2xl border border-border-strong bg-panel flex items-center justify-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text"
      >
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
    </div>
  );
}

function ConceptCard({
  label,
  title,
  body,
  href,
}: {
  label: string;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-panel border border-border rounded-lg p-5 hover:border-border-strong transition-colors text-left"
    >
      <div className="text-[10px] tracking-[0.2em] text-text-faint uppercase">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-text">{title}</div>
      <div className="mt-2 text-[12px] leading-relaxed text-text-dim">
        {body}
      </div>
      <div className="mt-4 text-[11px] text-text-faint group-hover:text-text-dim transition-colors">
        Open →
      </div>
    </Link>
  );
}

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
