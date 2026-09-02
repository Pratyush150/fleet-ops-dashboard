import { useId } from 'react';

export interface SparklineProps {
  readonly label: string;
  readonly unit: string;
  readonly values: readonly number[];
  readonly color: string;
  /** Optional fixed range; otherwise the range is taken from the data. */
  readonly domain?: readonly [number, number];
  readonly digits?: number;
}

const WIDTH = 240;
const HEIGHT = 56;
const PAD = 3;

/**
 * Inline SVG trend chart. No charting library: the whole thing is one polyline
 * plus a filled area, drawn from a rolling history buffer.
 *
 * `vector-effect="non-scaling-stroke"` keeps the line 1.5 px wide however the
 * container stretches, which matters because the chart is width-responsive.
 */
export function Sparkline({
  label,
  unit,
  values,
  color,
  domain,
  digits = 1,
}: SparklineProps): JSX.Element {
  const gradientId = useId();
  const latest = values.length > 0 ? values[values.length - 1] : undefined;

  if (values.length < 2) {
    return (
      <figure className="rounded-md border border-line bg-sunken p-2">
        <figcaption className="flex items-baseline justify-between text-xs text-ink-muted">
          <span>{label}</span>
          <span className="font-mono text-ink-faint">waiting for data</span>
        </figcaption>
        <div className="h-[56px]" aria-hidden="true" />
      </figure>
    );
  }

  const min = domain ? domain[0] : Math.min(...values);
  const max = domain ? domain[1] : Math.max(...values);
  const span = max - min || 1;
  const stepX = (WIDTH - PAD * 2) / (values.length - 1);

  const points = values.map((value, index) => {
    const x = PAD + index * stepX;
    const y = HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = points.join(' ');
  const area = `${PAD},${HEIGHT - PAD} ${line} ${(WIDTH - PAD).toFixed(2)},${HEIGHT - PAD}`;

  return (
    <figure className="rounded-md border border-line bg-sunken p-2">
      <figcaption className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="font-mono text-ink">
          {latest === undefined ? '--' : latest.toFixed(digits)} {unit}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="mt-1 h-[56px] w-full"
        role="img"
        aria-label={`${label} trend, latest ${latest?.toFixed(digits) ?? 'unknown'} ${unit}, range ${min.toFixed(digits)} to ${max.toFixed(digits)} ${unit}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-ink-faint">
        <span>{min.toFixed(digits)}</span>
        <span>{max.toFixed(digits)}</span>
      </div>
    </figure>
  );
}
