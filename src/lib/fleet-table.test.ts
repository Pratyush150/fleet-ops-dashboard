import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTER,
  applyTableView,
  filterVehicles,
  matchesQuery,
  sortVehicles,
  statusRank,
  summariseFleet,
} from './fleet-table';
import { makeVehicle } from '../test/factory';
import type { VehicleState } from '../types/telemetry';

const FLEET: VehicleState[] = [
  makeVehicle({ id: 'v01', name: 'MC-101', kind: 'quadrotor', status: 'nominal', batteryPct: 90, linkQualityPct: 88, mode: 'AUTO.MISSION' }),
  makeVehicle({ id: 'v02', name: 'VT-102', kind: 'vtol', status: 'critical', batteryPct: 12, linkQualityPct: 30, mode: 'AUTO.RTL' }),
  makeVehicle({ id: 'v03', name: 'UGV-103', kind: 'ground', status: 'warning', batteryPct: 28, linkQualityPct: 55, mode: 'OFFBOARD', altitudeM: 0 }),
  makeVehicle({ id: 'v04', name: 'MC-104', kind: 'quadrotor', status: 'offline', batteryPct: 61, linkQualityPct: 0, mode: 'HOLD', armed: false, telemetryAgeS: 12 }),
];

describe('sortVehicles', () => {
  it('sorts numerically in both directions', () => {
    const asc = sortVehicles(FLEET, { key: 'batteryPct', direction: 'asc' });
    expect(asc.map((v) => v.id)).toEqual(['v02', 'v03', 'v04', 'v01']);
    const desc = sortVehicles(FLEET, { key: 'batteryPct', direction: 'desc' });
    expect(desc.map((v) => v.id)).toEqual(['v01', 'v04', 'v03', 'v02']);
  });

  it('sorts by name alphabetically', () => {
    const asc = sortVehicles(FLEET, { key: 'name', direction: 'asc' });
    expect(asc.map((v) => v.name)).toEqual(['MC-101', 'MC-104', 'UGV-103', 'VT-102']);
  });

  it('puts the vehicles that need attention first when sorting by status', () => {
    const asc = sortVehicles(FLEET, { key: 'status', direction: 'asc' });
    expect(asc.map((v) => v.status)).toEqual(['offline', 'critical', 'warning', 'nominal']);
    expect(statusRank('offline')).toBeLessThan(statusRank('nominal'));
  });

  it('breaks ties by name so rows do not jitter between ticks', () => {
    const tied = [
      makeVehicle({ id: 'b', name: 'B', batteryPct: 50 }),
      makeVehicle({ id: 'a', name: 'A', batteryPct: 50 }),
    ];
    expect(sortVehicles(tied, { key: 'batteryPct', direction: 'desc' }).map((v) => v.name)).toEqual([
      'A',
      'B',
    ]);
  });

  it('does not mutate the input array', () => {
    const before = FLEET.map((v) => v.id);
    sortVehicles(FLEET, { key: 'batteryPct', direction: 'asc' });
    expect(FLEET.map((v) => v.id)).toEqual(before);
  });
});

describe('filterVehicles', () => {
  it('passes everything through with the default filter', () => {
    expect(filterVehicles(FLEET, DEFAULT_FILTER)).toHaveLength(4);
  });

  it('filters by status and by type', () => {
    expect(filterVehicles(FLEET, { ...DEFAULT_FILTER, status: 'critical' }).map((v) => v.id)).toEqual(['v02']);
    expect(filterVehicles(FLEET, { ...DEFAULT_FILTER, kind: 'quadrotor' })).toHaveLength(2);
  });

  it('searches name, id and mode case-insensitively', () => {
    expect(filterVehicles(FLEET, { ...DEFAULT_FILTER, query: 'ugv' }).map((v) => v.id)).toEqual(['v03']);
    expect(filterVehicles(FLEET, { ...DEFAULT_FILTER, query: 'v02' }).map((v) => v.id)).toEqual(['v02']);
    expect(filterVehicles(FLEET, { ...DEFAULT_FILTER, query: 'rtl' }).map((v) => v.id)).toEqual(['v02']);
  });

  it('combines filters conjunctively', () => {
    expect(
      filterVehicles(FLEET, { status: 'nominal', kind: 'vtol', query: '' }),
    ).toHaveLength(0);
  });

  it('treats a blank query as no filter and trims whitespace', () => {
    expect(matchesQuery(FLEET[0] as VehicleState, '   ')).toBe(true);
    expect(matchesQuery(FLEET[0] as VehicleState, ' mc-101 ')).toBe(true);
    expect(matchesQuery(FLEET[0] as VehicleState, 'nope')).toBe(false);
  });
});

describe('applyTableView', () => {
  it('filters before sorting', () => {
    const rows = applyTableView(
      FLEET,
      { ...DEFAULT_FILTER, kind: 'quadrotor' },
      { key: 'batteryPct', direction: 'asc' },
    );
    expect(rows.map((v) => v.id)).toEqual(['v04', 'v01']);
  });
});

describe('summariseFleet', () => {
  it('counts by status and excludes offline vehicles from the means', () => {
    const summary = summariseFleet(FLEET);
    expect(summary.total).toBe(4);
    expect(summary.byStatus.offline).toBe(1);
    expect(summary.byStatus.critical).toBe(1);
    expect(summary.armed).toBe(3);
    expect(summary.minBatteryPct).toBeCloseTo(12);
    expect(summary.meanBatteryPct).toBeCloseTo((90 + 12 + 28) / 3);
  });

  it('counts vehicles flying an automatic or offboard mission', () => {
    expect(summariseFleet(FLEET).inMission).toBe(3);
  });

  it('handles an empty fleet without dividing by zero', () => {
    const summary = summariseFleet([]);
    expect(summary.total).toBe(0);
    expect(summary.meanBatteryPct).toBe(0);
    expect(summary.minBatteryPct).toBe(0);
  });
});
