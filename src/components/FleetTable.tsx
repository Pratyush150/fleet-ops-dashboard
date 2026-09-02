import type { SortKey, SortState } from '../lib/fleet-table';
import { KIND_LABELS } from '../lib/format';
import { StatusPill } from './StatusPill';
import type { VehicleState } from '../types/telemetry';

export interface FleetTableProps {
  readonly vehicles: readonly VehicleState[];
  readonly sort: SortState;
  readonly onSortChange: (sort: SortState) => void;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

interface Column {
  readonly key: SortKey;
  readonly label: string;
  readonly numeric: boolean;
}

const COLUMNS: readonly Column[] = [
  { key: 'name', label: 'Vehicle', numeric: false },
  { key: 'kind', label: 'Type', numeric: false },
  { key: 'status', label: 'Status', numeric: false },
  { key: 'batteryPct', label: 'Batt %', numeric: true },
  { key: 'linkQualityPct', label: 'Link %', numeric: true },
  { key: 'altitudeM', label: 'Alt m', numeric: true },
  { key: 'groundSpeedMs', label: 'Spd m/s', numeric: true },
  { key: 'missionProgressPct', label: 'Mission %', numeric: true },
];

function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return { key, direction: key === 'name' ? 'asc' : 'desc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

/**
 * Fleet table. Headers are real buttons inside <th scope="col"> with
 * aria-sort, so sorting is keyboard operable and announced. Rows are
 * selectable with Enter or Space.
 */
export function FleetTable({
  vehicles,
  sort,
  onSortChange,
  selectedId,
  onSelect,
}: FleetTableProps): JSX.Element {
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">
          Fleet telemetry. Activate a column header to sort, a row to select the vehicle.
        </caption>
        <thead>
          <tr className="border-b border-line text-left">
            {COLUMNS.map((column) => {
              const active = sort.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  className={`sticky top-0 z-10 bg-panel px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted ${
                    column.numeric ? 'text-right' : 'text-left'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSortChange(nextSort(sort, column.key))}
                    className={`inline-flex w-full items-center gap-1 ${
                      column.numeric ? 'justify-end' : 'justify-start'
                    } hover:text-ink`}
                  >
                    {column.label}
                    <span aria-hidden="true" className={active ? 'text-accent' : 'text-ink-faint'}>
                      {active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const selected = v.id === selectedId;
            return (
              <tr
                key={v.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(v.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(v.id);
                  }
                }}
                className={`cursor-pointer border-b border-line/60 ${
                  selected ? 'bg-accent-soft' : 'hover:bg-raised'
                }`}
              >
                <th scope="row" className="px-2 py-1.5 text-left font-medium text-ink">
                  {v.name}
                  <span className="ml-1 font-mono text-[10px] text-ink-faint">{v.id}</span>
                </th>
                <td className="px-2 py-1.5 text-ink-muted">{KIND_LABELS[v.kind]}</td>
                <td className="px-2 py-1.5">
                  <StatusPill status={v.status} compact />
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-ink">
                  {v.batteryPct.toFixed(0)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-ink">
                  {v.linkQualityPct.toFixed(0)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-ink">
                  {v.altitudeM.toFixed(0)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-ink">
                  {v.groundSpeedMs.toFixed(1)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-ink">
                  {v.missionProgressPct.toFixed(0)}
                </td>
              </tr>
            );
          })}
          {vehicles.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-2 py-6 text-center text-ink-muted">
                No vehicles match the current filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
