/**
 * Telemetry domain types.
 *
 * Everything the UI renders is derived from a `FleetSnapshot`. The snapshot is
 * produced by the simulation in `src/lib/fleet-sim.ts`; nothing in the UI is
 * allowed to invent a field that the telemetry stream does not carry.
 *
 * Positions are in a local ENU frame in metres, with the origin at the
 * operations centre. Real ground stations carry lat/lon and project to a local
 * tangent plane; the projection is deliberately out of scope here, so the
 * simulation works directly in the projected frame.
 */

/** Airframe / chassis class. Drives speed envelope and power model. */
export type VehicleKind = 'quadrotor' | 'vtol' | 'ground';

/** Flight/drive mode, using PX4-style naming. */
export type FlightMode =
  | 'MANUAL'
  | 'POSITION'
  | 'HOLD'
  | 'AUTO.MISSION'
  | 'AUTO.RTL'
  | 'AUTO.LAND'
  | 'OFFBOARD';

/** GNSS fix quality, ordered worst to best. */
export type GpsFixType =
  | 'NO_FIX'
  | 'FIX_2D'
  | 'FIX_3D'
  | 'DGPS'
  | 'RTK_FLOAT'
  | 'RTK_FIXED';

/** Roll-up health used for colouring and for the summary strip. */
export type VehicleStatus = 'nominal' | 'warning' | 'critical' | 'offline';

/** 2D point in the local ENU frame, metres. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** One decoded telemetry frame for one vehicle. */
export interface VehicleState {
  readonly id: string;
  readonly name: string;
  readonly kind: VehicleKind;

  readonly position: Vec2;
  readonly home: Vec2;
  /** Metres above the home position. Ground vehicles report ~0. */
  readonly altitudeM: number;
  /** Degrees clockwise from north (0..360). */
  readonly headingDeg: number;
  readonly groundSpeedMs: number;
  readonly verticalSpeedMs: number;

  /** Remaining charge, 0..100. */
  readonly batteryPct: number;
  /** Pack voltage under the current load, volts. */
  readonly batteryVoltage: number;
  /** Instantaneous pack current, amps. */
  readonly batteryCurrentA: number;
  readonly batteryCells: number;

  /** Received signal strength at the ground station, dBm (negative). */
  readonly linkRssiDbm: number;
  /** 0..100, derived from RSSI and packet loss. */
  readonly linkQualityPct: number;
  readonly packetLossPct: number;
  /** Seconds since the ground station last decoded a frame from this vehicle. */
  readonly telemetryAgeS: number;

  readonly gpsFix: GpsFixType;
  readonly satellites: number;
  readonly hdop: number;

  readonly mode: FlightMode;
  readonly armed: boolean;

  readonly missionIndex: number;
  readonly missionTotal: number;
  /** 0..100 along the whole mission, including progress inside the current leg. */
  readonly missionProgressPct: number;

  readonly insideGeofence: boolean;
  readonly status: VehicleStatus;
}

/** The whole fleet at one simulation instant. */
export interface FleetSnapshot {
  readonly tick: number;
  /** Seconds of simulated time since the run started. */
  readonly simTimeS: number;
  /** Wall-clock epoch milliseconds the snapshot was produced. */
  readonly wallClockMs: number;
  readonly vehicles: readonly VehicleState[];
  /** Closed operating-area polygon, in the same ENU frame. */
  readonly geofence: readonly Vec2[];
}

/** Fields the history buffers retain for the trend charts. */
export interface TelemetrySample {
  readonly t: number;
  readonly altitudeM: number;
  readonly batteryVoltage: number;
  readonly linkRssiDbm: number;
}
