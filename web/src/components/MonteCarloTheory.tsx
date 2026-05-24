// Pure presentational component — long-form educational deep-dive on Monte Carlo simulation.
// Uses the existing dark theme tokens.

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-baseline gap-4">
        <span className="text-[11px] tabular-nums text-text-faint">{number}</span>
        <h3 className="text-base font-medium text-text">{title}</h3>
      </div>
      <div className="px-6 py-5 text-[13px] text-text-dim leading-[1.7] space-y-3.5">{children}</div>
    </section>
  );
}

function Math({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-panel-2 border border-border rounded p-3 text-[12.5px] font-mono text-text overflow-x-auto leading-[1.6]">
      {children}
    </pre>
  );
}

function Inline({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-panel-2 border border-border rounded px-1.5 py-0.5 text-[12px] font-mono text-text">
      {children}
    </code>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-text font-medium">{children}</span>;
}

export default function MonteCarloTheory() {
  return (
    <div className="space-y-6">
      <div className="px-1 pt-2">
        <div className="text-[11px] tracking-[0.2em] text-text-faint uppercase">Theory</div>
        <h2 className="text-xl font-semibold tracking-tight mt-1">How Monte Carlo simulation works</h2>
        <p className="text-sm text-text-dim mt-1.5 max-w-3xl">
          A guided tour of what&apos;s actually happening on this page — the math behind GBM and bootstrap,
          why log returns matter, how randomness is generated, and where Monte Carlo earns its keep in
          real finance.
        </p>
      </div>

      {/* 1. Core idea */}
      <Section number="01" title="The core idea — rolling dice instead of solving equations">
        <p>
          Monte Carlo simulation is named after the casino in Monaco — a place famous for randomness.
          The technique was developed in the 1940s by Stanislaw Ulam and John von Neumann while working
          on the Manhattan Project. The insight: instead of solving a hard problem analytically,
          <Strong> roll the dice many times and see what happens.</Strong>
        </p>
        <p>
          For stocks, the &quot;hard problem&quot; is: <em>given what we know about a stock&apos;s past,
          what are the plausible futures?</em> There&apos;s no analytical answer — the future depends on
          countless unknowable factors. But we can:
        </p>
        <ol className="list-decimal pl-6 space-y-1.5">
          <li>Estimate statistical properties from history (drift, volatility)</li>
          <li>Generate thousands of random future paths consistent with those properties</li>
          <li>Look at the <Strong>distribution</Strong> of outcomes, not a single point forecast</li>
        </ol>
        <p>
          A point forecast like <em>&quot;the stock will be at ₹1500 in a year&quot;</em> implies false
          certainty. Monte Carlo gives you the honest answer:{" "}
          <em>&quot;There&apos;s a 50% chance it&apos;ll be between X and Y, a 90% chance between A and B,
          and a 5% chance below C.&quot;</em>
        </p>
      </Section>

      {/* 2. Toy example */}
      <Section number="02" title="A simple Monte Carlo: estimating π by throwing darts">
        <p>
          The cleanest example has nothing to do with stocks. Here&apos;s how to estimate π:
        </p>
        <ol className="list-decimal pl-6 space-y-1.5">
          <li>Imagine a 1×1 square with a quarter-circle inscribed (radius 1, area π/4).</li>
          <li>Throw N darts at random points (x, y) in the square.</li>
          <li>Count how many land inside the circle (x² + y² ≤ 1).</li>
          <li>The ratio <Inline>inside / total</Inline> ≈ π/4 → multiply by 4 to get π.</li>
        </ol>
        <p>
          With 1,000 darts you get π ≈ 3.1; with 1,000,000 you get π ≈ 3.14159. Same principle here:
          <Strong> random sampling can answer questions that are hard or impossible to solve in closed form.</Strong>
        </p>
      </Section>

      {/* 3. GBM */}
      <Section number="03" title="Method 1 — Geometric Brownian Motion (GBM)">
        <p>
          This is the classical financial model — the same one underneath the Black-Scholes options
          pricing formula. It rests on three assumptions:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border border-border rounded">
            <thead>
              <tr className="text-text-faint text-[11px] uppercase tracking-[0.15em] bg-panel-2">
                <th className="text-left px-4 py-2 border-b border-border">Assumption</th>
                <th className="text-left px-4 py-2 border-b border-border">What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2 text-text border-b border-border align-top">Log returns are normal</td>
                <td className="px-4 py-2 border-b border-border">Daily change in ln(price) follows a bell curve</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-text border-b border-border align-top">Independence</td>
                <td className="px-4 py-2 border-b border-border">Today&apos;s return tells you nothing about tomorrow&apos;s</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-text align-top">Constant μ and σ</td>
                <td className="px-4 py-2">Drift and volatility don&apos;t change over time</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>The continuous-time stochastic differential equation:</p>
        <Math>{`dS = μ · S · dt + σ · S · dW`}</Math>
        <p>where <Inline>dW</Inline> is &quot;Brownian motion&quot; — infinitesimal random noise. The closed-form solution (via Itô&apos;s lemma):</p>
        <Math>{`S_t = S_0 · exp((μ − σ²/2) · t + σ · √t · Z),    Z ~ N(0, 1)`}</Math>
        <p>The discrete one-step update we actually compute in code:</p>
        <Math>{`S_{t+1} = S_t · exp(r),    where r ~ N(μ_log, σ²_log)`}</Math>
        <p>
          <Inline>μ_log</Inline> and <Inline>σ_log</Inline> are estimated from the asset&apos;s
          historical log returns (see the lookback selector above). Each path simply iterates this
          step <Inline>daysAhead</Inline> times.
        </p>
      </Section>

      {/* 4. Bootstrap */}
      <Section number="04" title="Method 2 — Historical bootstrap">
        <p>
          A non-parametric alternative. We don&apos;t assume any distribution shape; we just{" "}
          <Strong>resample actual historical returns</Strong> with replacement:
        </p>
        <Math>{`for each step:
  i  = uniform random index in 1..N
  r  = historical_log_returns[i]
  S_{t+1} = S_t · exp(r)`}</Math>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-panel-2 border border-border rounded p-4">
            <div className="text-[10px] tracking-[0.18em] text-up uppercase mb-2">Preserves</div>
            <ul className="space-y-1.5">
              <li>· <Strong>Fat tails</Strong> — if there was a −12% day in history, simulations can produce one</li>
              <li>· <Strong>Skewness</Strong> — equity returns are typically negatively skewed; bootstrap keeps that</li>
              <li>· <Strong>The actual empirical shape</Strong> — not just mean and std</li>
            </ul>
          </div>
          <div className="bg-panel-2 border border-border rounded p-4">
            <div className="text-[10px] tracking-[0.18em] text-down uppercase mb-2">Loses</div>
            <ul className="space-y-1.5">
              <li>· <Strong>Volatility clustering</Strong> — in reality, volatile days come in bunches (the GARCH effect); bootstrap treats each day as i.i.d.</li>
              <li>· <Strong>Regime context</Strong> — a 2008 crash day might get sampled into an otherwise calm 2024-like environment</li>
            </ul>
          </div>
        </div>
        <p>
          <Strong>When to use which:</Strong> GBM for clean math and faster theoretical convergence
          (it&apos;s the basis for Black-Scholes); bootstrap when you care about tail risk and want
          to be honest about how returns actually look.
        </p>
      </Section>

      {/* 5. Log returns */}
      <Section number="05" title="Why log returns?">
        <p>
          Prices can&apos;t go negative, and percentage changes compound multiplicatively. A +10% day
          followed by a −10% day leaves you below where you started:
        </p>
        <Math>{`1.00 × 1.10 × 0.90 = 0.99   (a 1% loss, not break-even)`}</Math>
        <p>Log returns are <Strong>additive</Strong> instead of multiplicative:</p>
        <Math>{`ln(1.10) + ln(0.90) ≈ +0.0953 − 0.1054 = −0.0101   (matches the −1% in log space)`}</Math>
        <p>
          This makes them statistically tractable: additive over time, well-behaved when you take
          means and variances, and consistent with the assumption that prices follow exponential
          growth with random noise on top.
        </p>
      </Section>

      {/* 6. σ²/2 adjustment */}
      <Section number="06" title="The σ²/2 adjustment (Jensen's inequality)">
        <p>
          You might wonder why GBM has that extra <Inline>−σ²/2</Inline> term in the drift. This is
          <Strong> Itô&apos;s lemma</Strong> applied to <Inline>S = exp(X)</Inline>, but the intuition
          is simpler:
        </p>
        <p>
          Since <Inline>exp(·)</Inline> is a convex function, the average of <Inline>exp(X)</Inline> is
          greater than <Inline>exp(average of X)</Inline> (Jensen&apos;s inequality). So if log returns
          have mean μ, the expected <em>price</em> grows faster than <Inline>exp(μ · t)</Inline>.
          To make the math consistent — so that <Inline>E[r] = μ</Inline> — we subtract <Inline>σ²/2</Inline>{" "}
          from the log drift.
        </p>
        <p>
          Practically: <Strong>volatility is a drag on long-term compound returns.</Strong> A stock with
          high σ needs a higher μ just to break even with a less volatile one delivering the same{" "}
          <em>arithmetic</em> mean return. This is why high-vol stocks often underperform their
          arithmetic average suggests.
        </p>
      </Section>

      {/* 7. √t rule */}
      <Section number="07" title="The √t rule — time scaling of volatility">
        <p>
          A crucial result: <Strong>volatility scales with the square root of time, not time itself.</Strong>
        </p>
        <p>If daily σ is 1%, then approximately:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border border-border rounded">
            <thead>
              <tr className="text-text-faint text-[11px] uppercase tracking-[0.15em] bg-panel-2">
                <th className="text-left px-4 py-2 border-b border-border">Horizon</th>
                <th className="text-left px-4 py-2 border-b border-border">Calculation</th>
                <th className="text-left px-4 py-2 border-b border-border">σ</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr><td className="px-4 py-2 text-text border-b border-border">Weekly (5d)</td><td className="px-4 py-2 border-b border-border font-mono text-[12px]">1% × √5</td><td className="px-4 py-2 border-b border-border">≈ 2.24%</td></tr>
              <tr><td className="px-4 py-2 text-text border-b border-border">Monthly (21d)</td><td className="px-4 py-2 border-b border-border font-mono text-[12px]">1% × √21</td><td className="px-4 py-2 border-b border-border">≈ 4.58%</td></tr>
              <tr><td className="px-4 py-2 text-text">Annual (252d)</td><td className="px-4 py-2 font-mono text-[12px]">1% × √252</td><td className="px-4 py-2">≈ 15.87%</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          This is why the fan chart widens <em>gradually</em>, not linearly. The 1-year cone is roughly
          16× wider than the 1-day cone, not 252×. The √t scaling is a direct consequence of returns
          being independent — variances add over time, so standard deviation grows as √t.
        </p>
      </Section>

      {/* 8. RNG / Box-Muller */}
      <Section number="08" title="Generating randomness — Mulberry32 + Box-Muller">
        <p>Two pieces are needed under the hood:</p>
        <p>
          <Strong>1. A pseudo-random generator</Strong> for uniform samples in [0, 1). JavaScript&apos;s
          built-in <Inline>Math.random()</Inline> isn&apos;t seedable, which makes runs irreproducible.
          We use <Strong>Mulberry32</Strong>, a tiny fast PRNG that takes a 32-bit seed:
        </p>
        <Math>{`state = seed
next:
  state = (state + 0x6D2B79F5) | 0
  t = state ⊕ (state >>> 15) · (1 | state)
  t = (t + (t ⊕ (t >>> 7)) · (61 | t)) ⊕ t
  return ((t ⊕ (t >>> 14)) >>> 0) / 2³²`}</Math>
        <p>
          Same seed → identical paths (great for debugging and reproducibility). Click <Strong>↻ Re-roll</Strong>{" "}
          above to advance to a new seed.
        </p>
        <p>
          <Strong>2. A normal sampler</Strong> to turn uniform samples into N(0, 1). We use the{" "}
          <Strong>Box-Muller transform</Strong>:
        </p>
        <Math>{`U₁, U₂ ~ Uniform(0, 1)
Z = √(−2 · ln(U₁)) · cos(2π · U₂)`}</Math>
        <p>
          The resulting Z is <em>exactly</em> N(0, 1) — it&apos;s not an approximation. It&apos;s an
          analytical transformation that maps the unit square onto the bivariate normal in polar
          coordinates. Elegant and fast.
        </p>
      </Section>

      {/* 9. Reading the fan */}
      <Section number="09" title="How to read the fan chart">
        <p>The bands show <Strong>where outcomes concentrate</Strong>, not where the price will go:</p>
        <ul className="space-y-2 pl-1">
          <li>· <Strong className="text-text">5th–95th band</Strong> (outer): under the model&apos;s assumptions, 90% of simulated outcomes fall inside</li>
          <li>· <Strong className="text-text">25th–75th band</Strong> (inner, darker): the middle 50% — the most &quot;typical&quot; range</li>
          <li>· <Strong className="text-text">Median line</Strong>: half the paths end above, half below</li>
          <li>· <Strong className="text-text">Faint sample paths</Strong>: individual random walks — none of these will happen exactly, but they show the <em>texture</em> of possible journeys</li>
          <li>· <Strong className="text-text">Yellow dashed line</Strong>: the starting price for reference</li>
        </ul>
        <p>
          The cone always widens because uncertainty compounds — a stock predictable over one day
          becomes highly unpredictable over a year. The model is honest about that.
        </p>
      </Section>

      {/* 10. Convergence */}
      <Section number="10" title="Convergence — how many paths do you actually need?">
        <p>
          Monte Carlo error decreases as <Strong>1/√N</Strong>, where N is the number of paths.
          Meaning:
        </p>
        <Math>{`1,000 paths    →  baseline precision
10,000 paths   →  ~3.2× more precise  (not 10×)
100,000 paths  →  ~10× more precise   (not 100×)`}</Math>
        <p>
          Diminishing returns are real. For most purposes <Strong>1,000–5,000 paths is plenty</Strong>.
          Adding more paths gives smoother percentile bands; it doesn&apos;t tell you anything new about
          the future. The error term that dominates after a few thousand paths is{" "}
          <em>model error</em>, not sampling error — and you can&apos;t reduce that by re-rolling.
        </p>
      </Section>

      {/* 11. What it can't do */}
      <Section number="11" title="What Monte Carlo can't do (and how it's commonly misread)">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border border-border rounded">
            <thead>
              <tr className="text-text-faint text-[11px] uppercase tracking-[0.15em] bg-panel-2">
                <th className="text-left px-4 py-2 border-b border-border">Wrong reading</th>
                <th className="text-left px-4 py-2 border-b border-border">Right reading</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2 text-down border-b border-border align-top">&quot;The stock will be at the median price in a year&quot;</td>
                <td className="px-4 py-2 text-up border-b border-border align-top">&quot;Half of plausible scenarios end above this, half below&quot;</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-down border-b border-border align-top">&quot;The 95th percentile is the upper bound&quot;</td>
                <td className="px-4 py-2 text-up border-b border-border align-top">&quot;Under our model&apos;s assumptions, 5% of scenarios end above this — reality may differ&quot;</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-down border-b border-border align-top">&quot;Bootstrap captures all real risk&quot;</td>
                <td className="px-4 py-2 text-up border-b border-border align-top">&quot;It captures all risk <em>if the future resembles the past</em>&quot;</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-down align-top">&quot;More paths = more accuracy about the future&quot;</td>
                <td className="px-4 py-2 text-up align-top">&quot;More paths = more accuracy about <em>what the model implies</em>. The model itself may be wrong.&quot;</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The biggest pitfall: confusing <em>&quot;what the model says could happen&quot;</em> with{" "}
          <em>&quot;what could actually happen&quot;</em>. Models systematically miss:
        </p>
        <ul className="space-y-1.5 pl-1">
          <li>· <Strong>Regime changes</Strong> — a stock that&apos;s calm for 10 years can suddenly become volatile</li>
          <li>· <Strong>Structural breaks</Strong> — mergers, scandals, regulatory shifts, demergers</li>
          <li>· <Strong>Black swan events</Strong> — COVID-style global shocks, wars, currency crises</li>
          <li>· <Strong>Autocorrelation</Strong> — volatility clustering (volatile days come in bunches); momentum or mean-reversion at certain horizons</li>
        </ul>
      </Section>

      {/* 12. Real-world uses */}
      <Section number="12" title="Where Monte Carlo lives in real finance">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-panel-2 border border-border rounded p-4">
            <div className="text-[10px] tracking-[0.18em] text-text-faint uppercase mb-2">Options pricing</div>
            <p>Especially for exotic options (Asian, barrier, lookback) where Black-Scholes has no closed form. The simulated paths become payoff scenarios, averaged and discounted.</p>
          </div>
          <div className="bg-panel-2 border border-border rounded p-4">
            <div className="text-[10px] tracking-[0.18em] text-text-faint uppercase mb-2">Value at Risk (VaR)</div>
            <p>&quot;What&apos;s the worst 1-day loss at 95% confidence?&quot; — the 5th percentile of the simulated next-day P&amp;L distribution.</p>
          </div>
          <div className="bg-panel-2 border border-border rounded p-4">
            <div className="text-[10px] tracking-[0.18em] text-text-faint uppercase mb-2">Stress testing</div>
            <p>Running portfolios through extreme but plausible scenarios — basis for regulatory capital requirements (Basel III, Solvency II).</p>
          </div>
          <div className="bg-panel-2 border border-border rounded p-4">
            <div className="text-[10px] tracking-[0.18em] text-text-faint uppercase mb-2">Retirement planning</div>
            <p>&quot;What&apos;s the probability of running out of money before 90?&quot; — simulate portfolio returns + withdrawals across thousands of paths.</p>
          </div>
          <div className="bg-panel-2 border border-border rounded p-4">
            <div className="text-[10px] tracking-[0.18em] text-text-faint uppercase mb-2">Portfolio optimization</div>
            <p>Simulating asset correlations under stress to build robust portfolios that hold up beyond the Markowitz mean-variance assumptions.</p>
          </div>
          <div className="bg-panel-2 border border-border rounded p-4">
            <div className="text-[10px] tracking-[0.18em] text-text-faint uppercase mb-2">Real options</div>
            <p>Valuing flexibility in capital projects (e.g., the option to expand a mine or defer a factory build) — useful where deterministic NPV understates value.</p>
          </div>
        </div>
      </Section>

      {/* 13. Further reading */}
      <Section number="13" title="If you want to go deeper">
        <ul className="space-y-2 pl-1">
          <li>· <Strong>Hull, &quot;Options, Futures, and Other Derivatives&quot;</Strong> — the standard textbook covering GBM, Itô&apos;s lemma, and Monte Carlo for derivatives</li>
          <li>· <Strong>Glasserman, &quot;Monte Carlo Methods in Financial Engineering&quot;</Strong> — the deep dive: variance reduction, quasi-Monte Carlo, stratified sampling</li>
          <li>· <Strong>Taleb, &quot;Dynamic Hedging&quot; / &quot;The Black Swan&quot;</Strong> — sharp critiques of why GBM-style models systematically understate tail risk</li>
          <li>· <Strong>Engle (1982), &quot;Autoregressive Conditional Heteroscedasticity&quot;</Strong> — the GARCH paper that introduced volatility clustering into financial modeling</li>
          <li>· <Strong>Box &amp; Muller (1958)</Strong> — the original two-page paper introducing the normal-sampling transform we use here</li>
        </ul>
      </Section>
    </div>
  );
}
