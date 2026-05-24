import PageHeader from "@/components/PageHeader";
import CorrelationMatrix from "@/components/CorrelationMatrix";

export default function CorrelationsPage() {
  return (
    <>
      <PageHeader
        title="Correlation Matrix"
        subtitle="Pairwise Pearson correlation of daily returns"
        meta="How tightly each pair moves together. Higher = same direction."
      />
      <div className="p-10">
        <CorrelationMatrix />
      </div>
    </>
  );
}
