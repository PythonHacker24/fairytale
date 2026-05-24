import { Suspense } from "react";
import MonteCarloDashboard from "@/components/MonteCarloDashboard";

export default function MonteCarloPage() {
  return (
    <Suspense fallback={<div className="p-10 text-text-faint text-xs">Loading…</div>}>
      <MonteCarloDashboard />
    </Suspense>
  );
}
