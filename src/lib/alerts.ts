/**
 * Alert engine.
 *
 * Alerts are derived from telemetry, never scripted. The engine is fed a
 * snapshot per tick and runs a small state machine per (vehicle, rule).
 *
 * Two mechanisms stop a noisy signal producing a wall of alerts:
 *
 *  1. Hysteresis. Each rule has separate enter and exit thresholds. A battery
 *     sitting on 30.0% cannot latch and clear once a second, because clearing
 *     needs 33%.
 *  2. Dwell. A rule must hold its enter condition for `enterDwellS` seconds of
 *     simulated time before it raises, and hold the exit condition for
 *     `exitDwellS` before it clears. A single dropped frame is not a link loss.
 */

import type { Alert, AlertFilter, AlertKind, AlertSeverity } from '../types/alerts';
import type { FleetSnapshot, VehicleState } from '../types/telemetry';

export interface AlertRule {
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  /** Condition that starts the raise timer. */
  readonly enter: (v: VehicleState) => boolean;
  /** Condition that starts the clear timer. Must be strictly looser than `enter`. */
  readonly exit: (v: VehicleState) => boolean;
  readonly enterDwellS: number;
  readonly exitDwellS: number;
  readonly describe: (v: VehicleState) => string;
}

export const ALERT_RULES: readonly AlertRule[] = [
  {
    kind: 'UNRESPONSIVE',
    severity: 'critical',
    enter: (v) => v.telemetryAgeS >= 5,
    exit: (v) => v.telemetryAgeS < 2,
    enterDwellS: 0,
    exitDwellS: 2,
    describe: (v) => `No telemetry for ${v.telemetryAgeS.toFixed(0)} s`,
  },
  {
    kind: 'CRITICAL_BATTERY',
    severity: 'critical',
    enter: (v) => v.batteryPct <= 15,
    exit: (v) => v.batteryPct >= 18,
    enterDwellS: 2,
    exitDwellS: 6,
    describe: (v) => `Battery ${v.batteryPct.toFixed(0)}% (${v.batteryVoltage.toFixed(1)} V)`,
  },
  {
    kind: 'LOW_BATTERY',
    severity: 'warning',
    enter: (v) => v.batteryPct <= 30,
    exit: (v) => v.batteryPct >= 33,
    enterDwellS: 3,
    exitDwellS: 8,
    describe: (v) => `Battery ${v.batteryPct.toFixed(0)}% (${v.batteryVoltage.toFixed(1)} V)`,
  },
  {
    kind: 'GEOFENCE_BREACH',
    severity: 'critical',
    enter: (v) => !v.insideGeofence,
    exit: (v) => v.insideGeofence,
    enterDwellS: 1.5,
    exitDwellS: 4,
    describe: (v) =>
      `Outside operating area at ${v.position.x.toFixed(0)}, ${v.position.y.toFixed(0)} m`,
  },
  {
    kind: 'LINK_LOSS',
    severity: 'warning',
    enter: (v) => v.linkQualityPct <= 25 || v.packetLossPct >= 40,
    exit: (v) => v.linkQualityPct >= 35 && v.packetLossPct <= 25,
    enterDwellS: 2,
    exitDwellS: 6,
    describe: (v) =>
      `Link ${v.linkQualityPct.toFixed(0)}% at ${v.linkRssiDbm.toFixed(0)} dBm, ` +
      `${v.packetLossPct.toFixed(0)}% loss`,
  },
  {
    kind: 'GPS_DEGRADED',
    severity: 'warning',
    enter: (v) => v.satellites < 8 || v.hdop > 2.5,
    exit: (v) => v.satellites >= 10 && v.hdop <= 2.0,
    enterDwellS: 2.5,
    exitDwellS: 6,
    describe: (v) => `${v.gpsFix} with ${v.satellites} sats, HDOP ${v.hdop.toFixed(1)}`,
  },
];

interface RuleState {
  active: boolean;
  /** Sim time the enter condition first held continuously, or null. */
  enterSinceS: number | null;
  exitSinceS: number | null;
  /** Id of the alert currently latched by this rule. */
  alertId: string | null;
}

export interface AlertEngineOptions {
  /** Maximum retained alerts, newest first. Older entries are dropped. */
  readonly maxAlerts?: number;
  readonly rules?: readonly AlertRule[];
}

export class AlertEngine {
  private readonly rules: readonly AlertRule[];
  private readonly maxAlerts: number;
  private readonly states = new Map<string, RuleState>();
  private alerts: Alert[] = [];

  constructor(options: AlertEngineOptions = {}) {
    this.rules = options.rules ?? ALERT_RULES;
    this.maxAlerts = options.maxAlerts ?? 200;
  }

  /** Newest first. */
  list(): readonly Alert[] {
    return this.alerts;
  }

  reset(): void {
    this.states.clear();
    this.alerts = [];
  }

  acknowledge(id: string): void {
    this.alerts = this.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a));
  }

  acknowledgeAll(): void {
    this.alerts = this.alerts.map((a) => (a.acknowledged ? a : { ...a, acknowledged: true }));
  }

  /** Feed one snapshot. Returns the alerts raised by this tick, oldest first. */
  update(snapshot: FleetSnapshot): Alert[] {
    const raised: Alert[] = [];
    for (const vehicle of snapshot.vehicles) {
      for (const rule of this.rules) {
        const event = this.stepRule(rule, vehicle, snapshot);
        if (event) raised.push(event);
      }
    }
    if (raised.length > 0) {
      this.alerts = [...raised].reverse().concat(this.alerts).slice(0, this.maxAlerts);
    }
    return raised;
  }

  private stepRule(
    rule: AlertRule,
    vehicle: VehicleState,
    snapshot: FleetSnapshot,
  ): Alert | null {
    const key = `${vehicle.id}:${rule.kind}`;
    const state: RuleState = this.states.get(key) ?? {
      active: false,
      enterSinceS: null,
      exitSinceS: null,
      alertId: null,
    };
    this.states.set(key, state);
    const t = snapshot.simTimeS;

    if (!state.active) {
      if (rule.enter(vehicle)) {
        if (state.enterSinceS === null) state.enterSinceS = t;
        if (t - state.enterSinceS >= rule.enterDwellS) {
          state.active = true;
          state.enterSinceS = null;
          state.exitSinceS = null;
          const alert: Alert = {
            id: `${vehicle.id}:${rule.kind}:${t.toFixed(1)}`,
            vehicleId: vehicle.id,
            vehicleName: vehicle.name,
            kind: rule.kind,
            severity: rule.severity,
            message: rule.describe(vehicle),
            raisedAtS: t,
            raisedAtMs: snapshot.wallClockMs,
            clearedAtS: null,
            acknowledged: false,
          };
          state.alertId = alert.id;
          return alert;
        }
      } else {
        state.enterSinceS = null;
      }
      return null;
    }

    // Active: only the exit condition can clear it, and only after the dwell.
    if (rule.exit(vehicle)) {
      if (state.exitSinceS === null) state.exitSinceS = t;
      if (t - state.exitSinceS >= rule.exitDwellS) {
        state.active = false;
        state.exitSinceS = null;
        const id = state.alertId;
        state.alertId = null;
        if (id) {
          this.alerts = this.alerts.map((a) =>
            a.id === id && a.clearedAtS === null ? { ...a, clearedAtS: t } : a,
          );
        }
      }
    } else {
      state.exitSinceS = null;
    }
    return null;
  }
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function severityRank(severity: AlertSeverity): number {
  return SEVERITY_ORDER[severity];
}

/** Filter the feed. Pure, so it is unit tested directly. */
export function filterAlerts(alerts: readonly Alert[], filter: AlertFilter): Alert[] {
  switch (filter) {
    case 'all':
      return [...alerts];
    case 'active':
      return alerts.filter((a) => a.clearedAtS === null);
    case 'unacknowledged':
      return alerts.filter((a) => !a.acknowledged);
    default:
      return alerts.filter((a) => a.severity === filter);
  }
}

export function countActiveBySeverity(
  alerts: readonly Alert[],
): Record<AlertSeverity, number> {
  const counts: Record<AlertSeverity, number> = { info: 0, warning: 0, critical: 0 };
  for (const alert of alerts) {
    if (alert.clearedAtS === null) counts[alert.severity] += 1;
  }
  return counts;
}

export const ALERT_LABELS: Record<AlertKind, string> = {
  LOW_BATTERY: 'Low battery',
  CRITICAL_BATTERY: 'Critical battery',
  LINK_LOSS: 'Link loss',
  GPS_DEGRADED: 'GPS degraded',
  GEOFENCE_BREACH: 'Geofence breach',
  UNRESPONSIVE: 'Unresponsive',
};
