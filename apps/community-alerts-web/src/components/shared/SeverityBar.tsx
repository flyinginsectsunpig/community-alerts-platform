import { SEVERITY_COLORS } from '@/lib/constants';

interface Props {
  severity: number;
  /** 'sm' = h-0.5 bars (card list), 'md' = h-1 bars (detail/map panel), 'lg' = h-2 bars (detail pane) */
  size?: 'sm' | 'md' | 'lg';
  /** Show the "n/5" label after the bar */
  showLabel?: boolean;
}

const HEIGHT: Record<string, string> = {
  sm: 'h-0.5',
  md: 'h-1.5',
  lg: 'h-2',
};

export function SeverityBar({ severity, size = 'lg', showLabel = false }: Props) {
  const h = HEIGHT[size];
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`${h} rounded-full flex-1`}
          style={{ background: n <= severity ? SEVERITY_COLORS[severity] : '#222636' }}
        />
      ))}
      {showLabel && (
        <span className="font-mono text-[10px] text-text-dim">{severity}/5</span>
      )}
    </div>
  );
}
