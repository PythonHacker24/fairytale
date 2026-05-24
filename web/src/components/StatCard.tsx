type Tone = "neutral" | "up" | "down";

type Props = {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
};

const toneClasses: Record<Tone, string> = {
  neutral: "text-text",
  up: "text-up",
  down: "text-down",
};

export default function StatCard({ label, value, sub, tone = "neutral" }: Props) {
  return (
    <div className="bg-panel border border-border rounded-lg p-5">
      <div className="text-[10px] tracking-[0.2em] text-text-faint uppercase">{label}</div>
      <div className={`text-2xl font-semibold mt-2 tabular-nums ${toneClasses[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-text-faint mt-1.5 tabular-nums">{sub}</div>}
    </div>
  );
}
