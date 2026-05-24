export default function DisclaimerFooter() {
  return (
    <footer className="border-t border-border mt-12 px-10 py-8">
      <div className="max-w-3xl text-[11px] text-text-faint leading-relaxed space-y-3">
        <div className="tracking-[0.2em] uppercase text-text-dim">Disclaimer</div>
        <p>
          fairytale is a personal research and learning project. Nothing on
          this site is investment advice. It is not affiliated with any
          brokerage, exchange, custodian, advisor, or financial institution.
        </p>
        <p>
          Market data is sourced from Yahoo Finance via yfinance and may be
          incomplete, delayed, stale, adjusted differently than you expect, or
          simply wrong. No warranty is made as to accuracy, completeness, or
          timeliness, and the site may stop being updated at any time. Past
          performance does not predict future returns. Any decision you make
          based on anything shown here is entirely your own responsibility.
        </p>
      </div>
    </footer>
  );
}
