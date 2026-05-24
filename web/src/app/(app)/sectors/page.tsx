import PageHeader from "@/components/PageHeader";
import SectorHeatmap from "@/components/SectorHeatmap";
import { loadSectorReturns } from "@/lib/data";

export const revalidate = 300;

export default async function SectorsPage() {
  const rows = await loadSectorReturns();
  const stockCount = rows.filter((r) => r.type === "stock").length;

  return (
    <>
      <PageHeader
        title="Sector Heatmap"
        subtitle={`${stockCount} stocks across ${new Set(rows.filter((r) => r.type === "stock").map((r) => r.category)).size} sectors`}
        meta="Color is return over the selected period. Pick a timeframe."
      />
      <div className="p-10">
        <SectorHeatmap rows={rows} />
      </div>
    </>
  );
}
