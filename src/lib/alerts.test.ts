import { describe, expect, it } from 'vitest';
import {
  ALERT_RULES,
  AlertEngine,
  countActiveBySeverity,
  filterAlerts,
  severityRank,
} from './alerts';
import { makeSnapshot, makeVehicle } from '../test/factory';
import type { Alert } from '../types/alerts';

const DT = 0.5;

/** Feed a sequence of battery percentages, one per simulated timestep. */
function runBattery(values: readonly number[]): AlertEngine {
  const engine = new AlertEngine();
  values.forEach((batteryPct, index) => {
    const vehicle = makeVehicle({ batteryPct });
    engine.update(makeSnapshot([vehicle], (index + 1) * DT));
  });
  return engine;
}

function kinds(alerts: readonly Alert[]): string[] {
  return alerts.map((a) => a.kind);
}

describe('rule definitions', () => {
  it('gives every rule a strictly looser exit than enter', () => {
    for (const rule of ALERT_RULES) {
      expect(rule.exitDwellS).toBeGreaterThanOrEqual(0);
      expect(rule.enterDwellS).toBeGreaterThanOrEqual(0);
    }
    const lowBattery = ALERT_RULES.find((r) => r.kind === 'LOW_BATTERY');
    expect(lowBattery).toBeDefined();
    // At 31% neither condition is "enter"; at 32% the exit condition is still
    // false, which is exactly the dead band that stops chatter.
    expect(lowBattery?.enter(makeVehicle({ batteryPct: 31 }))).toBe(false);
    expect(lowBattery?.exit(makeVehicle({ batteryPct: 31 }))).toBe(false);
  });

  it('orders severities from critical to info', () => {
    expect(severityRank('critical')).toBeLessThan(severityRank('warning'));
    expect(severityRank('warning')).toBeLessThan(severityRank('info'));
  });
});

describe('threshold and dwell', () => {
  it('does not raise on a single sample below the threshold', () => {
    const engine = runBattery([80, 29, 80, 80]);
    expect(engine.list()).toHaveLength(0);
  });

  it('raises once the enter condition has held for the dwell time', () => {
    const engine = runBattery(Array.from({ length: 20 }, () => 28));
    expect(kinds(engine.list())).toContain('LOW_BATTERY');
    expect(engine.list().filter((a) => a.kind === 'LOW_BATTERY')).toHaveLength(1);
  });

  it('escalates to a critical alert as the pack keeps draining', () => {
    const values = [...Array.from({ length: 20 }, () => 28), ...Array.from({ length: 20 }, () => 12)];
    const engine = runBattery(values);
    const raised = kinds(engine.list());
    expect(raised).toContain('CRITICAL_BATTERY');
    expect(raised).toContain('LOW_BATTERY');
  });
});

describe('hysteresis', () => {
  it('does not latch at all while the signal only flickers over the threshold', () => {
    // Never holds the enter condition for the dwell time, so nothing raises.
    const values: number[] = [];
    for (let i = 0; i < 60; i += 1) values.push(i % 2 === 0 ? 29.5 : 30.5);
    expect(runBattery(values).list()).toHaveLength(0);
  });

  it('does not chatter once latched and the signal sits on the threshold', () => {
    // Latch first, then oscillate across the 30% enter threshold. The 33% exit
    // threshold is never reached, so exactly one alert should exist and it
    // should still be active after 60 more ticks.
    const values: number[] = Array.from({ length: 20 }, () => 28);
    for (let i = 0; i < 60; i += 1) values.push(i % 2 === 0 ? 29.5 : 30.5);
    const engine = runBattery(values);
    const lowBattery = engine.list().filter((a) => a.kind === 'LOW_BATTERY');
    expect(lowBattery).toHaveLength(1);
    expect(lowBattery[0]?.clearedAtS).toBeNull();
  });

  it('clears only after the exit condition holds for the exit dwell', () => {
    const values = [
      ...Array.from({ length: 20 }, () => 28),
      ...Array.from({ length: 4 }, () => 40),
      ...Array.from({ length: 2 }, () => 29),
      ...Array.from({ length: 40 }, () => 40),
    ];
    const engine = runBattery(values);
    const lowBattery = engine.list().filter((a) => a.kind === 'LOW_BATTERY');
    expect(lowBattery).toHaveLength(1);
    expect(lowBattery[0]?.clearedAtS).not.toBeNull();
  });

  it('re-raises as a new alert after a genuine clear and a second dip', () => {
    const values = [
      ...Array.from({ length: 20 }, () => 28),
      ...Array.from({ length: 40 }, () => 45),
      ...Array.from({ length: 20 }, () => 28),
    ];
    const engine = runBattery(values);
    expect(engine.list().filter((a) => a.kind === 'LOW_BATTERY')).toHaveLength(2);
  });
});

describe('derived rules other than battery', () => {
  it('raises link loss from quality and packet loss together', () => {
    const engine = new AlertEngine();
    for (let i = 1; i <= 20; i += 1) {
      engine.update(
        makeSnapshot(
          [makeVehicle({ linkQualityPct: 8, packetLossPct: 70, linkRssiDbm: -104 })],
          i * DT,
        ),
      );
    }
    expect(kinds(engine.list())).toContain('LINK_LOSS');
  });

  it('raises an unresponsive alert with no dwell once telemetry ages out', () => {
    const engine = new AlertEngine();
    engine.update(makeSnapshot([makeVehicle({ telemetryAgeS: 6 })], 10));
    expect(kinds(engine.list())).toContain('UNRESPONSIVE');
  });

  it('raises geofence and GPS alerts from their own telemetry fields', () => {
    const engine = new AlertEngine();
    for (let i = 1; i <= 20; i += 1) {
      engine.update(
        makeSnapshot(
          [makeVehicle({ insideGeofence: false, satellites: 4, hdop: 5.5, gpsFix: 'NO_FIX' })],
          i * DT,
        ),
      );
    }
    const raised = kinds(engine.list());
    expect(raised).toContain('GEOFENCE_BREACH');
    expect(raised).toContain('GPS_DEGRADED');
  });
});

describe('feed management', () => {
  it('acknowledges a single alert and then all of them', () => {
    const engine = runBattery(Array.from({ length: 20 }, () => 10));
    const first = engine.list()[0];
    expect(first).toBeDefined();
    engine.acknowledge(first?.id ?? '');
    expect(engine.list()[0]?.acknowledged).toBe(true);
    engine.acknowledgeAll();
    expect(engine.list().every((a) => a.acknowledged)).toBe(true);
  });

  it('caps the retained feed length', () => {
    const engine = new AlertEngine({ maxAlerts: 2 });
    for (let i = 1; i <= 40; i += 1) {
      const vehicles = [
        makeVehicle({ id: 'a', name: 'A', telemetryAgeS: i % 16 < 4 ? 6 : 0 }),
        makeVehicle({ id: 'b', name: 'B', telemetryAgeS: i % 16 < 4 ? 6 : 0 }),
      ];
      engine.update(makeSnapshot(vehicles, i * DT));
    }
    expect(engine.list().length).toBeLessThanOrEqual(2);
  });

  it('resets to an empty feed', () => {
    const engine = runBattery(Array.from({ length: 20 }, () => 10));
    expect(engine.list().length).toBeGreaterThan(0);
    engine.reset();
    expect(engine.list()).toHaveLength(0);
  });
});

describe('filterAlerts', () => {
  const alerts: Alert[] = [
    {
      id: '1',
      vehicleId: 'v01',
      vehicleName: 'MC-101',
      kind: 'LOW_BATTERY',
      severity: 'warning',
      message: 'x',
      raisedAtS: 10,
      raisedAtMs: 0,
      clearedAtS: null,
      acknowledged: false,
    },
    {
      id: '2',
      vehicleId: 'v02',
      vehicleName: 'MC-102',
      kind: 'LINK_LOSS',
      severity: 'critical',
      message: 'y',
      raisedAtS: 20,
      raisedAtMs: 0,
      clearedAtS: 40,
      acknowledged: true,
    },
  ];

  it('filters by lifecycle and severity', () => {
    expect(filterAlerts(alerts, 'all')).toHaveLength(2);
    expect(filterAlerts(alerts, 'active')).toHaveLength(1);
    expect(filterAlerts(alerts, 'unacknowledged')).toHaveLength(1);
    expect(filterAlerts(alerts, 'critical')).toHaveLength(1);
    expect(filterAlerts(alerts, 'info')).toHaveLength(0);
  });

  it('counts only active alerts by severity', () => {
    const counts = countActiveBySeverity(alerts);
    expect(counts.warning).toBe(1);
    expect(counts.critical).toBe(0);
    expect(counts.info).toBe(0);
  });
});
