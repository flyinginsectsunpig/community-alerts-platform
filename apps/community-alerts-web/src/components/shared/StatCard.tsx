interface Props {
  value: string | number;
  label: string;
  sub?: string;
  color?: string;
}

export function StatCard({ value, label, sub, color }: Props) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="font-mono text-[9px] text-text-dim mt-0.5">{sub}</div>}
    </div>
  );
}
