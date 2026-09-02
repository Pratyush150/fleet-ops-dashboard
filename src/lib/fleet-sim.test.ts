import { describe, expect, it } from 'vitest';
import { AlertEngine } from './alerts';
import {
  DEFAULT_FLEET_SIZE,
  GEOFENCE,
  SIM_DT_S,
  buildFaultSchedule,
  createSimulation,
  deriveStatus,
} from './fleet-sim';
import { pointInPolygon } from './math';
import { rngFromSeed } from './rng';
import type { FleetSnapshot, VehicleState } from '../types/telemetry';

function advance(seed: string, ticks: number): FleetSnapshot {
  const sim = createSimulation(seed);
  let snapshot = sim.snapshot();
  for (let i = 0; i < ticks; i += 1) snapshot = sim.step();
  return snapshot;
}

/** Compare everything except the wall clock, which is intentionally real time. */
function stateOf(snapshot: FleetSnapshot): string {
  return JSON.stringify({ t: snapshot.simTimeS, vehicles: snapshot.vehicles });
}

describe('fleet construction', () => {
  it('builds the requested fleet with unique ids and all three vehicle classes', () => {
    const snapshot = createSimulation('ops-2026').snapshot();
    expect(snapshot.vehicles).toHaveLength(DEFAULT_FLEET_SIZE);
    const ids = new Set(snapshot.vehicles.map((v) => v.id));
    expect(ids.size).toBe(DEFAULT_FLEET_SIZE);
    const kinds = new Set(snapshot.vehicles.map((v) => v.kind));
    expect(kinds).toEqual(new Set(['quadrotor', 'vtol', 'ground']));
  });

  it('starts every vehicle inside the geofence', () => {
    const snapshot = createSimulation('ops-2026').snapshot();
    for (const vehicle of snapshot.vehicles) {
      expect(pointInPolygon(vehicle.home, GEOFENCE)).toBe(true);
    }
  });

  it('advances simulated time by a fixed timestep', () => {
    const sim = createSimulation('ops-2026');
    sim.step();
    sim.step();
    expect(sim.simTimeS).toBeCloseTo(2 * SIM_DT_S);
    expect(sim.snapshot().tick).toBe(2);
  });
});

describe('determinism', () => {
  it('produces identical state for the same seed after N ticks', () => {
    expect(stateOf(advance('alpha', 240))).toBe(stateOf(advance('alpha', 240)));
  });

  it('produces different state for a different seed', () => {
    expect(stateOf(advance('alpha', 240))).not.toBe(stateOf(advance('bravo', 240)));
  });

  it('rewinds to the same run after reset', () => {
    const sim = createSimulation('charlie');
    for (let i = 0; i < 50; i += 1) sim.step();
    const first = stateOf(sim.snapshot());
    sim.reset();
    for (let i = 0; i < 50; i += 1) sim.step();
    expect(stateOf(sim.snapshot())).toBe(first);
  });

  it('derives the same fault schedule from the same seed', () => {
    const a = buildFaultSchedule(rngFromSeed('delta'), 12);
    const b = buildFaultSchedule(rngFromSeed('delta'), 12);
    const c = buildFaultSchedule(rngFromSeed('echo'), 12);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe('fault injection', () => {
  it('schedules every fault kind at least once, in time order', () => {
    const schedule = createSimulation('ops-2026').faultSchedule;
    const kinds = new Set(schedule.map((f) => f.kind));
    expect(kinds).toEqual(
      new Set(['LINK_DROP', 'BATTERY_SAG', 'GPS_DEGRADED', 'GEOFENCE_BREACH', 'UNRESPONSIVE']),
    );
    for (let i = 1; i < schedule.length; i += 1) {
      expect(schedule[i]?.startS).toBeGreaterThanOrEqual(schedule[i - 1]?.startS ?? 0);
    }
    for (const window of schedule) {
      expect(window.endS).toBeGreaterThan(window.startS);
      expect(window.vehicleIndex).toBeGreaterThanOrEqual(0);
      expect(window.vehicleIndex).toBeLessThan(DEFAULT_FLEET_SIZE);
    }
  });

  it('drives at least one vehicle unresponsive and one link into the floor', () => {
    const sim = createSimulation('ops-2026');
    let sawStaleTelemetry = false;
    let sawWeakLink = false;
    for (let i = 0; i < 1200; i += 1) {
      const snapshot = sim.step();
      for (const v of snapshot.vehicles) {
        if (v.telemetryAgeS >= 5) sawStaleTelemetry = true;
        if (v.linkQualityPct <= 25) sawWeakLink = true;
      }
    }
    expect(sawStaleTelemetry).toBe(true);
    expect(sawWeakLink).toBe(true);
  });

  it('feeds the alert engine enough real telemetry to raise alerts', () => {
    const sim = createSimulation('ops-2026');
    const engine = new AlertEngine();
    for (let i = 0; i < 1200; i += 1) engine.update(sim.step());
    expect(engine.list().length).toBeGreaterThan(0);
    const kinds = new Set(engine.list().map((a) => a.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });
});

describe('telemetry sanity', () => {
  it('keeps every field finite and inside its physical range', () => {
    const snapshot = advance('foxtrot', 400);
    for (const v of snapshot.vehicles) {
      expect(Number.isFinite(v.position.x)).toBe(true);
      expect(Number.isFinite(v.position.y)).toBe(true);
      expect(v.batteryPct).toBeGreaterThanOrEqual(0);
      expect(v.batteryPct).toBeLessThanOrEqual(100);
      expect(v.headingDeg).toBeGreaterThanOrEqual(0);
      expect(v.headingDeg).toBeLessThan(360);
      expect(v.altitudeM).toBeGreaterThanOrEqual(0);
      expect(v.linkQualityPct).toBeGreaterThanOrEqual(0);
      expect(v.linkQualityPct).toBeLessThanOrEqual(100);
      expect(v.missionProgressPct).toBeGreaterThanOrEqual(0);
      expect(v.missionProgressPct).toBeLessThanOrEqual(100);
    }
  });

  it('never recharges a battery in flight', () => {
    const sim = createSimulation('golf');
    const previous = new Map<string, number>();
    for (let i = 0; i < 600; i += 1) {
      for (const v of sim.step().vehicles) {
        const last = previous.get(v.id);
        if (last !== undefined) expect(v.batteryPct).toBeLessThanOrEqual(last + 1e-6);
        previous.set(v.id, v.batteryPct);
      }
    }
  });

  it('keeps ground robots on the ground', () => {
    const snapshot = advance('hotel', 300);
    for (const v of snapshot.vehicles) {
      if (v.kind === 'ground') expect(v.altitudeM).toBeCloseTo(0, 3);
    }
  });
});

describe('deriveStatus', () => {
  const base = {
    telemetryAgeS: 0,
    batteryPct: 90,
    linkQualityPct: 80,
    insideGeofence: true,
    gpsFix: 'RTK_FIXED' as VehicleState['gpsFix'],
  };

  it('reports offline before anything else', () => {
    expect(deriveStatus({ ...base, telemetryAgeS: 9, batteryPct: 2 })).toBe('offline');
  });

  it('reports critical for a flat pack, a lost link or a fence breach', () => {
    expect(deriveStatus({ ...base, batteryPct: 10 })).toBe('critical');
    expect(deriveStatus({ ...base, linkQualityPct: 5 })).toBe('critical');
    expect(deriveStatus({ ...base, insideGeofence: false })).toBe('critical');
  });

  it('reports warning for a degraded but flyable vehicle', () => {
    expect(deriveStatus({ ...base, batteryPct: 25 })).toBe('warning');
    expect(deriveStatus({ ...base, linkQualityPct: 35 })).toBe('warning');
    expect(deriveStatus({ ...base, gpsFix: 'FIX_2D' })).toBe('warning');
  });

  it('reports nominal otherwise', () => {
    expect(deriveStatus(base)).toBe('nominal');
  });
});
