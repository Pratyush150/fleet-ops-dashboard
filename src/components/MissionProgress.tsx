export interface MissionProgressProps {
  readonly percent: number;
  readonly index: number;
  readonly total: number;
}

/** Mission completion bar. Uses a real progressbar role so it is announced. */
export function MissionProgress({ percent, index, total }: MissionProgressProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="rounded-md border border-line bg-sunken p-3">
      <div className="flex items-baseline justify-between text-xs text-ink-muted">
        <span>Mission</span>
        <span className="font-mono text-ink">
          waypoint {index} / {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label="Mission progress"
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-panel"
      >
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[11px] text-ink-faint">{clamped.toFixed(1)} % complete</p>
    </div>
  );
}
