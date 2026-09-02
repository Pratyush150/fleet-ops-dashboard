import { ALERT_LABELS, filterAlerts } from '../lib/alerts';
import { SEVERITY_TOKENS, clockFromSeconds, wallClock } from '../lib/format';
import type { Alert, AlertFilter } from '../types/alerts';

export interface AlertFeedProps {
  readonly alerts: readonly Alert[];
  readonly filter: AlertFilter;
  readonly onFilterChange: (filter: AlertFilter) => void;
  readonly onAcknowledge: (id: string) => void;
  readonly onAcknowledgeAll: () => void;
  readonly onSelectVehicle: (id: string) => void;
}

const FILTERS: readonly { value: AlertFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'unacknowledged', label: 'Unacked' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'all', label: 'All' },
];

/**
 * Alert feed. Newest first, with an aria-live region so a screen reader
 * announces new alerts without the operator having to poll the panel.
 *
 * Nothing here decides what an alert is: the list comes from the alert engine,
 * which derives it from telemetry with thresholds and hysteresis.
 */
export function AlertFeed({
  alerts,
  filter,
  onFilterChange,
  onAcknowledge,
  onAcknowledgeAll,
  onSelectVehicle,
}: AlertFeedProps): JSX.Element {
  const visible = filterAlerts(alerts, filter).slice(0, 60);
  const unacked = alerts.filter((a) => !a.acknowledged).length;

  return (
    <section aria-label="Alert feed" className="flex h-full flex-col rounded-lg border border-line bg-panel">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">Alerts</h2>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink-muted">
          {unacked} unacked
        </span>
        <div className="ml-auto flex flex-wrap gap-1" role="group" aria-label="Alert filter">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => onFilterChange(option.value)}
              className={`rounded border px-2 py-0.5 text-[11px] ${
                filter === option.value
                  ? 'border-accent bg-accent-soft text-ink'
                  : 'border-line bg-raised text-ink-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onAcknowledgeAll}
            className="rounded border border-line bg-raised px-2 py-0.5 text-[11px] text-ink-muted hover:text-ink"
          >
            Ack all
          </button>
        </div>
      </header>

      <ul
        aria-live="polite"
        aria-relevant="additions"
        className="scroll-thin flex-1 divide-y divide-line/60 overflow-y-auto"
      >
        {visible.map((alert) => (
          <li key={alert.id} className="flex items-start gap-2 px-3 py-2">
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{
                background: SEVERITY_TOKENS[alert.severity],
                opacity: alert.clearedAtS === null ? 1 : 0.35,
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => onSelectVehicle(alert.vehicleId)}
                  className="font-medium text-ink underline decoration-dotted underline-offset-2"
                >
                  {alert.vehicleName}
                </button>
                <span className="font-semibold" style={{ color: SEVERITY_TOKENS[alert.severity] }}>
                  {ALERT_LABELS[alert.kind]}
                </span>
                {alert.clearedAtS !== null ? (
                  <span className="rounded bg-raised px-1 text-[10px] text-ink-faint">cleared</span>
                ) : null}
              </p>
              <p className="truncate font-mono text-[11px] text-ink-muted">{alert.message}</p>
              <p className="font-mono text-[10px] text-ink-faint">
                T+{clockFromSeconds(alert.raisedAtS)} · {wallClock(alert.raisedAtMs)}
              </p>
            </div>
            <button
              type="button"
              disabled={alert.acknowledged}
              onClick={() => onAcknowledge(alert.id)}
              className="shrink-0 rounded border border-line px-2 py-0.5 text-[11px] text-ink-muted enabled:hover:text-ink disabled:opacity-40"
            >
              {alert.acknowledged ? 'Acked' : 'Ack'}
            </button>
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-ink-muted">
            No alerts match this filter.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
