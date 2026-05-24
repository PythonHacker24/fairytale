type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
};

export default function ChartCard({ title, subtitle, children, height = 480 }: Props) {
  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-[11px] tracking-[0.18em] text-text-faint uppercase">{title}</div>
        {subtitle && <div className="text-[13px] text-text-dim mt-1">{subtitle}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}
