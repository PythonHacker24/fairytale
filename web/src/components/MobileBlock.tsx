import Link from "next/link";

export default function MobileBlock() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-16 h-16 rounded-2xl border border-border-strong bg-panel flex items-center justify-center mb-6">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text"
        >
          <line x1="12" y1="3" x2="12" y2="21" />
          <ellipse cx="12" cy="12" rx="4.5" ry="4" />
          <line x1="19" y1="4" x2="19" y2="7" />
          <line x1="17.5" y1="5.5" x2="20.5" y2="5.5" />
          <line x1="5" y1="18" x2="5" y2="20" />
          <line x1="4" y1="19" x2="6" y2="19" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-text">
        Better on a larger screen
      </h1>

      <p className="mt-4 max-w-sm text-sm text-text-dim leading-relaxed">
        The fairytale playground uses dense charts, side-by-side panels, and
        50-asset heatmaps designed for desktop and laptop screens. On a phone
        the visuals get cramped and most interactions do not translate.
      </p>

      <p className="mt-3 max-w-sm text-[13px] text-text-faint leading-relaxed">
        Open this on a desktop or laptop browser, ideally at least 1024px wide,
        to explore the data properly.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 bg-panel border border-border-strong hover:border-text rounded px-4 py-2 text-sm text-text transition-colors"
      >
        Back to the landing page
      </Link>

      <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-text-faint tracking-[0.2em] uppercase">
        fairytale
      </div>
    </div>
  );
}
