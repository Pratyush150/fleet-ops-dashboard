import { countActiveBySeverity } from '../lib/alerts';
import type { FleetSummary } from '../lib/fleet-table';
import { STATUS_TOKENS } from '../lib/format';
import type { Alert } from '../types/alerts';

export interface SummaryStripProps {
  readonly summary: FleetSummary;
  readonly alerts: readonly Alert[];
}

interface TileProps {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly accent?: string | undefined;
}

function Tile({ label, value, detail, accent }: TileProps): JSX.Element {
  return (
    <div className="min-w-[9.5rem] flex-1 rounded-lg border border-line bg-panel px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p
        className="font-mono text-xl leading-tight text-ink"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      <p className="text-[11px] text-ink-muted">{detail}</p>
    </div>
  );
}

/** Fleet-wide roll-up. Every number here is recomputed from the live snapshot. */
export function SummaryStrip({ summary, alerts }: SummaryStripProps): JSX.Element {
  const active = countActiveBySeverity(alerts);
  const unacked = alerts.filter((a) => !a.acknowledged && a.clearedAtS === null).length;
  const degraded = summary.byStatus.warning + summary.byStatus.critical;

  return (
    <section aria-label="Fleet summary" className="flex flex-wrap gap-2">
      <Tile
        label="Fleet"
        value={String(summary.total)}
        detail={`${summary.armed} armed / ${summary.inMission} in mission`}
      />
      <Tile
        label="Nominal"
        value={String(summary.byStatus.nominal)}
        detail={`${degraded} degraded`}
        accent={STATUS_TOKENS.nominal}
      />
      <Tile
        label="Critical"
        value={String(summary.byStatus.critical)}
        detail={`${summary.byStatus.warning} warning`}
        accent={summary.byStatus.critical > 0 ? STATUS_TOKENS.critical : undefined}
      />
      <Tile
        label="Offline"
        value={String(summary.byStatus.offline)}
        detail="no telemetry"
        accent={summary.byStatus.offline > 0 ? STATUS_TOKENS.offline : undefined}
      />
      <Tile
        label="Mean battery"
        value={`${summary.meanBatteryPct.toFixed(0)} %`}
        detail={`lowest ${summary.minBatteryPct.toFixed(0)} %`}
      />
      <Tile
        label="Mean link"
        value={`${summary.meanLinkQualityPct.toFixed(0)} %`}
        detail="excludes offline"
      />
      <Tile
        label="Active alerts"
        value={String(active.critical + active.warning + active.info)}
        detail={`${unacked} unacknowledged`}
        accent={active.critical > 0 ? STATUS_TOKENS.critical : undefined}
      />
    </section>
  );
}
