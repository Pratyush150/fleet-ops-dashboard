/** Alert domain types. Alerts are derived from telemetry, never scripted. */

export type AlertKind =
  | 'LOW_BATTERY'
  | 'CRITICAL_BATTERY'
  | 'LINK_LOSS'
  | 'GPS_DEGRADED'
  | 'GEOFENCE_BREACH'
  | 'UNRESPONSIVE';

/** Ordered least to most urgent. */
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  /** Stable across the life of one activation: `${vehicleId}:${kind}:${raisedAtS}`. */
  readonly id: string;
  readonly vehicleId: string;
  readonly vehicleName: string;
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  readonly message: string;
  /** Simulation time the rule latched, seconds. */
  readonly raisedAtS: number;
  /** Wall-clock epoch milliseconds, for display. */
  readonly raisedAtMs: number;
  /** Simulation time the rule cleared, or null while still active. */
  readonly clearedAtS: number | null;
  readonly acknowledged: boolean;
}

export type AlertFilter = 'all' | 'active' | 'unacknowledged' | AlertSeverity;
