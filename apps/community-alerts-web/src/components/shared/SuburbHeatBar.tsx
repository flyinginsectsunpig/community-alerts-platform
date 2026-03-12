import { ALERT_LEVEL_COLOR } from '@/lib/constants';

interface Props {
  weight: number;
  alertLevel?: string;
  /** Extra CSS classes applied to the outer .heat-bar wrapper */
  className?: string;
}

export function SuburbHeatBar({ weight, alertLevel, className }: Props) {
  const color = ALERT_LEVEL_COLOR[alertLevel ?? 'GREEN'];
  const pct = Math.min(100, (weight / 50) * 100);
  return (
    <div className={`heat-bar${className ? ` ${className}` : ''}`}>
      <div className="heat-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
