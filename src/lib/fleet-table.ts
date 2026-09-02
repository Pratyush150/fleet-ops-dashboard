/**
 * Pure sorting and filtering for the fleet table.
 *
 * Split out of the component so the behaviour is unit tested without a DOM:
 * the table component only decides how to render the result.
 */

import type { VehicleKind, VehicleState, VehicleStatus } from '../types/telemetry';

export type SortKey =
  | 'name'
  | 'kind'
  | 'status'
  | 'batteryPct'
  | 'linkQualityPct'
  | 'altitudeM'
  | 'groundSpeedMs'
  | 'missionProgressPct';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

export interface FleetFilter {
  readonly status: VehicleStatus | 'all';
  readonly kind: VehicleKind | 'all';
  readonly query: string;
}

export const DEFAULT_FILTER: FleetFilter = { status: 'all', kind: 'all', query: '' };

/** Worst first, so "sort by status" surfaces the vehicles that need attention. */
const STATUS_ORDER: Record<VehicleStatus, number> = {
  offline: 0,
  critical: 1,
  warning: 2,
  nominal: 3,
};

export function statusRank(status: VehicleStatus): number {
  return STATUS_ORDER[status];
}

function compareBy(key: SortKey, a: VehicleState, b: VehicleState): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'kind':
      return a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name);
    case 'status':
      return statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name);
    default:
      return a[key] - b[key];
  }
}

/**
 * Stable sort. Ties fall back to vehicle name so the rows do not jitter between
 * ticks when two vehicles share a value.
 */
export function sortVehicles(
  vehicles: readonly VehicleState[],
  sort: SortState,
): VehicleState[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...vehicles].sort((a, b) => {
    const primary = compareBy(sort.key, a, b);
    if (primary !== 0) return primary * sign;
    return a.name.localeCompare(b.name);
  });
}

/** Case-insensitive match over name, id, kind, mode and status. */
export function matchesQuery(vehicle: VehicleState, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (query === '') return true;
  const haystack = [
    vehicle.name,
    vehicle.id,
    vehicle.kind,
    vehicle.mode,
    vehicle.status,
    vehicle.gpsFix,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export function filterVehicles(
  vehicles: readonly VehicleState[],
  filter: FleetFilter,
): VehicleState[] {
  return vehicles.filter((v) => {
    if (filter.status !== 'all' && v.status !== filter.status) return false;
    if (filter.kind !== 'all' && v.kind !== filter.kind) return false;
    return matchesQuery(v, filter.query);
  });
}

export function applyTableView(
  vehicles: readonly VehicleState[],
  filter: FleetFilter,
  sort: SortState,
): VehicleState[] {
  return sortVehicles(filterVehicles(vehicles, filter), sort);
}

export interface FleetSummary {
  readonly total: number;
  readonly byStatus: Record<VehicleStatus, number>;
  readonly meanBatteryPct: number;
  readonly minBatteryPct: number;
  readonly inMission: number;
  readonly armed: number;
  readonly meanLinkQualityPct: number;
}

/** Aggregates for the summary strip. Offline vehicles are excluded from means. */
export function summariseFleet(vehicles: readonly VehicleState[]): FleetSummary {
  const byStatus: Record<VehicleStatus, number> = {
    nominal: 0,
    warning: 0,
    critical: 0,
    offline: 0,
  };
  let batterySum = 0;
  let linkSum = 0;
  let counted = 0;
  let minBattery = vehicles.length > 0 ? 100 : 0;
  let inMission = 0;
  let armed = 0;

  for (const v of vehicles) {
    byStatus[v.status] += 1;
    if (v.armed) armed += 1;
    if (v.mode.startsWith('AUTO.') || v.mode === 'OFFBOARD') inMission += 1;
    if (v.status !== 'offline') {
      batterySum += v.batteryPct;
      linkSum += v.linkQualityPct;
      counted += 1;
      minBattery = Math.min(minBattery, v.batteryPct);
    }
  }

  return {
    total: vehicles.length,
    byStatus,
    meanBatteryPct: counted > 0 ? batterySum / counted : 0,
    minBatteryPct: counted > 0 ? minBattery : 0,
    inMission,
    armed,
    meanLinkQualityPct: counted > 0 ? linkSum / counted : 0,
  };
}
