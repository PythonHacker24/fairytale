type Props = {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, meta }: Props) {
  return (
    <div className="px-10 pt-10 pb-6 border-b border-border">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-text-dim mt-1">{subtitle}</p>}
        </div>
        {meta && <div className="text-xs text-text-faint">{meta}</div>}
      </div>
    </div>
  );
}
