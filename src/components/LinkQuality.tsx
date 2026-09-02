export interface LinkQualityProps {
  readonly qualityPct: number;
  readonly rssiDbm: number;
  readonly packetLossPct: number;
  readonly telemetryAgeS: number;
}

const BARS = 5;

function tokenFor(quality: number): string {
  if (quality <= 12) return 'var(--status-critical)';
  if (quality <= 40) return 'var(--status-warning)';
  return 'var(--status-nominal)';
}

/** Signal-strength bars plus the raw radio numbers an operator actually needs. */
export function LinkQuality({
  qualityPct,
  rssiDbm,
  packetLossPct,
  telemetryAgeS,
}: LinkQualityProps): JSX.Element {
  const litBars = Math.round((Math.max(0, Math.min(100, qualityPct)) / 100) * BARS);
  const color = tokenFor(qualityPct);
  return (
    <div className="rounded-md border border-line bg-sunken p-3">
      <div className="flex items-baseline justify-between text-xs text-ink-muted">
        <span>Radio link</span>
        <span className="font-mono text-sm text-ink">{qualityPct.toFixed(0)} %</span>
      </div>
      <svg
        viewBox="0 0 100 34"
        className="mt-2 h-9 w-24"
        role="img"
        aria-label={`Link quality ${qualityPct.toFixed(0)} percent, ${rssiDbm.toFixed(0)} dBm`}
      >
        {Array.from({ length: BARS }, (_, i) => {
          const height = 8 + i * 5;
          return (
            <rect
              key={i}
              x={i * 19 + 2}
              y={32 - height}
              width="14"
              height={height}
              rx="2"
              fill={i < litBars ? color : 'var(--bg-panel)'}
              stroke="var(--border-default)"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
        <div>
          <dt className="text-ink-faint">RSSI</dt>
          <dd className="text-ink">{rssiDbm.toFixed(0)} dBm</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Loss</dt>
          <dd className="text-ink">{packetLossPct.toFixed(0)} %</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Age</dt>
          <dd className="text-ink">{telemetryAgeS.toFixed(1)} s</dd>
        </div>
      </dl>
    </div>
  );
}
