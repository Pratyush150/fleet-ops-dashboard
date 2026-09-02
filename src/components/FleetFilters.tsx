import type { FleetFilter } from '../lib/fleet-table';
import { KIND_LABELS, STATUS_LABELS } from '../lib/format';
import type { VehicleKind, VehicleStatus } from '../types/telemetry';

export interface FleetFiltersProps {
  readonly filter: FleetFilter;
  readonly onChange: (filter: FleetFilter) => void;
  readonly resultCount: number;
  readonly totalCount: number;
}

const STATUSES: readonly VehicleStatus[] = ['nominal', 'warning', 'critical', 'offline'];
const KINDS: readonly VehicleKind[] = ['quadrotor', 'vtol', 'ground'];

const CONTROL =
  'rounded border border-line bg-raised px-2 py-1 text-xs text-ink ' +
  'focus-visible:outline-none';

/** Search plus status/type filters. All three combine; state lives in the parent. */
export function FleetFilters({
  filter,
  onChange,
  resultCount,
  totalCount,
}: FleetFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
        <span className="sr-only">Search vehicles</span>
        <input
          type="search"
          value={filter.query}
          placeholder="Search name, id, mode…"
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
          className={`${CONTROL} w-44 placeholder:text-ink-faint`}
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
        Status
        <select
          value={filter.status}
          onChange={(event) =>
            onChange({ ...filter, status: event.target.value as FleetFilter['status'] })
          }
          className={CONTROL}
        >
          <option value="all">All</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
        Type
        <select
          value={filter.kind}
          onChange={(event) =>
            onChange({ ...filter, kind: event.target.value as FleetFilter['kind'] })
          }
          className={CONTROL}
        >
          <option value="all">All</option>
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>

      <p className="ml-auto font-mono text-[11px] text-ink-faint">
        {resultCount} / {totalCount} shown
      </p>
    </div>
  );
}
