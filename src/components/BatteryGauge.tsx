export interface BatteryGaugeProps {
  readonly percent: number;
  readonly voltage: number;
  readonly currentA: number;
  readonly cells: number;
}

function fillToken(percent: number): string {
  if (percent <= 15) return 'var(--status-critical)';
  if (percent <= 30) return 'var(--status-warning)';
  return 'var(--status-nominal)';
}

/**
 * Battery gauge drawn as SVG so the fill colour comes straight from the same
 * thresholds the alert rules use. Per-cell voltage is shown because that is the
 * number that actually tells you whether a pack is sagging.
 */
export function BatteryGauge({
  percent,
  voltage,
  currentA,
  cells,
}: BatteryGaugeProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent));
  const perCell = cells > 0 ? voltage / cells : 0;
  return (
    <div className="rounded-md border border-line bg-sunken p-3">
      <div className="flex items-baseline justify-between text-xs text-ink-muted">
        <span>Battery</span>
        <span className="font-mono text-sm text-ink">{clamped.toFixed(0)} %</span>
      </div>
      <svg
        viewBox="0 0 200 44"
        className="mt-2 h-11 w-full"
        role="img"
        aria-label={`Battery ${clamped.toFixed(0)} percent, ${voltage.toFixed(2)} volts`}
      >
        <rect
          x="2"
          y="6"
          width="180"
          height="32"
          rx="5"
          fill="var(--bg-panel)"
          stroke="var(--border-strong)"
          strokeWidth="2"
        />
        <rect x="184" y="16" width="10" height="12" rx="2" fill="var(--border-strong)" />
        <rect
          x="6"
          y="10"
          width={Math.max(0, (clamped / 100) * 172)}
          height="24"
          rx="3"
          fill={fillToken(clamped)}
        />
        {[25, 50, 75].map((mark) => (
          <line
            key={mark}
            x1={6 + (mark / 100) * 172}
            y1="10"
            x2={6 + (mark / 100) * 172}
            y2="34"
            stroke="var(--bg-panel)"
            strokeWidth="1"
            opacity="0.6"
          />
        ))}
      </svg>
      <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
        <div>
          <dt className="text-ink-faint">Pack</dt>
          <dd className="text-ink">{voltage.toFixed(2)} V</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Per cell</dt>
          <dd className="text-ink">{perCell.toFixed(2)} V</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Draw</dt>
          <dd className="text-ink">{currentA.toFixed(1)} A</dd>
        </div>
      </dl>
    </div>
  );
}
