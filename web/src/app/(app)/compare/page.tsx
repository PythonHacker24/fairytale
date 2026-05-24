import { Suspense } from "react";
import CompareDashboard from "@/components/CompareDashboard";

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-10 text-text-faint text-xs">Loading…</div>}>
      <CompareDashboard />
    </Suspense>
  );
}
