/**
 * Mock telemetry engine.
 *
 * This is the backend of the demo. It runs a fleet of vehicles around a set of
 * generated missions inside a fixed geofence and emits a full telemetry
 * snapshot every tick. Every value the UI shows comes from here.
 *
 * Design rules:
 *  - Deterministic. Given the same seed and the same number of `step()` calls,
 *    the snapshot is byte-identical. No `Math.random()`, no `Date.now()` inside
 *    the physics, no floating wall-clock dt. `step()` always advances SIM_DT_S.
 *  - Faults are injected into the *telemetry*, not into the alert list. The
 *    alert engine has to notice the link RSSI collapsing on its own, the same
 *    way it would against a real radio.
 *  - The fault schedule is derived from the seed, so a seed reproduces a
 *    scenario end to end: same fault, same vehicle, same second.
 */

import { clamp, distance, headingTo, angleDelta, pointInPolygon } from './math';
import { drainBattery, packCurrent, packVoltage, type PowerSpec } from './power';
import { gaussian, randInt, rngFromSeed, uniform, type Rng } from './rng';
import type {
  FleetSnapshot,
  FlightMode,
  GpsFixType,
  Vec2,
  VehicleKind,
  VehicleState,
  VehicleStatus,
} from '../types/telemetry';

/** Fixed simulation timestep. Tick rate is a UI concern, not a physics one. */
export const SIM_DT_S = 0.5;
export const DEFAULT_FLEET_SIZE = 12;
export const DEFAULT_SEED = 'ops-2026';

/** Operating area, local ENU metres. Hand-picked so it is not a boring square. */
export const GEOFENCE: readonly Vec2[] = [
  { x: -900, y: -520 },
  { x: -250, y: -760 },
  { x: 520, y: -640 },
  { x: 900, y: -80 },
  { x: 720, y: 620 },
  { x: 60, y: 820 },
  { x: -640, y: 560 },
  { x: -940, y: 120 },
];

export type FaultKind =
  | 'LINK_DROP'
  | 'BATTERY_SAG'
  | 'GPS_DEGRADED'
  | 'GEOFENCE_BREACH'
  | 'UNRESPONSIVE';

export interface FaultWindow {
  readonly kind: FaultKind;
  readonly vehicleIndex: number;
  readonly startS: number;
  readonly endS: number;
}

interface KindProfile {
  readonly label: string;
  readonly cruiseMs: number;
  readonly cruiseAltM: number;
  readonly power: PowerSpec;
  readonly turnRateDegS: number;
}

const PROFILES: Record<VehicleKind, KindProfile> = {
  quadrotor: {
    label: 'MC',
    cruiseMs: 12,
    cruiseAltM: 60,
    turnRateDegS: 60,
    power: {
      cells: 6,
      capacityAh: 16,
      idleCurrentA: 3.2,
      speedCurrentA: 1.9,
      climbCurrentA: 6.5,
      internalOhms: 0.022,
    },
  },
  vtol: {
    label: 'VT',
    cruiseMs: 22,
    cruiseAltM: 120,
    turnRateDegS: 25,
    power: {
      cells: 6,
      capacityAh: 22,
      idleCurrentA: 2.4,
      speedCurrentA: 0.9,
      climbCurrentA: 5.0,
      internalOhms: 0.018,
    },
  },
  ground: {
    label: 'UGV',
    cruiseMs: 2.4,
    cruiseAltM: 0,
    turnRateDegS: 45,
    power: {
      cells: 8,
      capacityAh: 30,
      idleCurrentA: 1.6,
      speedCurrentA: 4.5,
      climbCurrentA: 0,
      internalOhms: 0.03,
    },
  },
};

const FLEET_LAYOUT: readonly VehicleKind[] = [
  'quadrotor',
  'quadrotor',
  'vtol',
  'ground',
  'quadrotor',
  'vtol',
  'ground',
  'quadrotor',
  'quadrotor',
  'ground',
  'vtol',
  'quadrotor',
];

interface VehicleSim {
  id: string;
  name: string;
  kind: VehicleKind;
  profile: KindProfile;
  home: Vec2;
  route: Vec2[];
  legLengths: number[];
  routeLength: number;
  legIndex: number;
  legProgressM: number;
  position: Vec2;
  altitudeM: number;
  headingDeg: number;
  groundSpeedMs: number;
  verticalSpeedMs: number;
  batteryPct: number;
  batteryVoltage: number;
  batteryCurrentA: number;
  rssiDbm: number;
  packetLossPct: number;
  satellites: number;
  hdop: number;
  mode: FlightMode;
  armed: boolean;
  lastFrameS: number;
  /** Cached telemetry frozen while the vehicle is unresponsive. */
  frozen: boolean;
  breachTarget: Vec2 | null;
  rng: Rng;
  noisePhase: number;
}

function sampleInsidePolygon(rng: Rng, polygon: readonly Vec2[]): Vec2 {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = { x: uniform(rng, -900, 900), y: uniform(rng, -760, 820) };
    if (pointInPolygon(candidate, polygon)) return candidate;
  }
  return { x: 0, y: 0 };
}

function buildRoute(rng: Rng, home: Vec2, legs: number): Vec2[] {
  const route: Vec2[] = [home];
  for (let i = 0; i < legs; i += 1) {
    route.push(sampleInsidePolygon(rng, GEOFENCE));
  }
  return route;
}

function legLengthsOf(route: readonly Vec2[]): number[] {
  const lengths: number[] = [];
  for (let i = 0; i < route.length; i += 1) {
    const a = route[i];
    const b = route[(i + 1) % route.length];
    lengths.push(a && b ? Math.max(distance(a, b), 1) : 1);
  }
  return lengths;
}

/**
 * Build the fault schedule for a run.
 *
 * Every fault kind fires at least once and the first one lands early enough
 * that an operator watching the demo sees something happen inside a minute of
 * simulated time. Which vehicle gets which fault is seed-dependent.
 */
export function buildFaultSchedule(rng: Rng, fleetSize: number): FaultWindow[] {
  const kinds: FaultKind[] = [
    'LINK_DROP',
    'BATTERY_SAG',
    'GPS_DEGRADED',
    'GEOFENCE_BREACH',
    'UNRESPONSIVE',
  ];
  const windows: FaultWindow[] = [];
  let cursorS = 25;
  for (const kind of kinds) {
    const startS = cursorS + uniform(rng, 0, 20);
    const durationS = kind === 'BATTERY_SAG' ? uniform(rng, 240, 420) : uniform(rng, 55, 130);
    windows.push({
      kind,
      vehicleIndex: randInt(rng, 0, fleetSize - 1),
      startS,
      endS: startS + durationS,
    });
    cursorS += 45;
  }
  // A second pass of repeats, so the feed keeps producing events on a long run.
  for (let i = 0; i < 6; i += 1) {
    const kind = kinds[randInt(rng, 0, kinds.length - 1)] ?? 'LINK_DROP';
    const startS = 320 + i * 95 + uniform(rng, 0, 60);
    windows.push({
      kind,
      vehicleIndex: randInt(rng, 0, fleetSize - 1),
      startS,
      endS: startS + uniform(rng, 60, 200),
    });
  }
  return windows.sort((a, b) => a.startS - b.startS);
}

/** 0 outside the window, ramping to 1 across the middle. Gives alerts a real edge to cross. */
function faultEnvelope(window: FaultWindow, tS: number): number {
  if (tS < window.startS || tS > window.endS) return 0;
  const span = window.endS - window.startS;
  const ramp = Math.min(12, span / 4);
  const since = tS - window.startS;
  const until = window.endS - tS;
  return clamp(Math.min(since / ramp, until / ramp, 1), 0, 1);
}

function gpsFixFor(satellites: number, hdop: number): GpsFixType {
  if (satellites < 5) return 'NO_FIX';
  if (satellites < 8 || hdop > 3.5) return 'FIX_2D';
  if (hdop > 1.6) return 'FIX_3D';
  if (hdop > 1.1) return 'DGPS';
  if (hdop > 0.75) return 'RTK_FLOAT';
  return 'RTK_FIXED';
}

function linkQualityFrom(rssiDbm: number, packetLossPct: number): number {
  // -50 dBm is a full-scale link, -105 dBm is the floor for these radios.
  const fromRssi = clamp(((rssiDbm + 105) / 55) * 100, 0, 100);
  return clamp(fromRssi * (1 - packetLossPct / 100), 0, 100);
}

/** Roll-up health. Purely a function of the frame, so the table and map agree. */
export function deriveStatus(v: {
  telemetryAgeS: number;
  batteryPct: number;
  linkQualityPct: number;
  insideGeofence: boolean;
  gpsFix: GpsFixType;
}): VehicleStatus {
  if (v.telemetryAgeS >= 5) return 'offline';
  if (v.batteryPct <= 15 || !v.insideGeofence || v.linkQualityPct <= 12) return 'critical';
  if (
    v.batteryPct <= 30 ||
    v.linkQualityPct <= 40 ||
    v.gpsFix === 'FIX_2D' ||
    v.gpsFix === 'NO_FIX'
  ) {
    return 'warning';
  }
  return 'nominal';
}

export class FleetSimulation {
  readonly seed: string;
  readonly fleetSize: number;
  readonly geofence: readonly Vec2[] = GEOFENCE;

  private vehicles: VehicleSim[] = [];
  private faults: FaultWindow[] = [];
  private tickCount = 0;
  private timeS = 0;

  constructor(seed: string = DEFAULT_SEED, fleetSize: number = DEFAULT_FLEET_SIZE) {
    this.seed = seed;
    this.fleetSize = clamp(fleetSize, 1, FLEET_LAYOUT.length);
    this.reset();
  }

  /** Rebuild the fleet from the seed. Called by the constructor and by the seed input. */
  reset(): void {
    const rng = rngFromSeed(this.seed);
    this.tickCount = 0;
    this.timeS = 0;
    this.vehicles = [];
    for (let i = 0; i < this.fleetSize; i += 1) {
      const kind = FLEET_LAYOUT[i] ?? 'quadrotor';
      const profile = PROFILES[kind];
      const home = sampleInsidePolygon(rng, GEOFENCE);
      const route = buildRoute(rng, home, randInt(rng, 4, 7));
      const legLengths = legLengthsOf(route);
      const startPct = uniform(rng, 62, 99);
      const start = route[0] ?? home;
      this.vehicles.push({
        id: `v${String(i + 1).padStart(2, '0')}`,
        name: `${profile.label}-${String(101 + i)}`,
        kind,
        profile,
        home,
        route,
        legLengths,
        routeLength: legLengths.reduce((a, b) => a + b, 0),
        legIndex: 0,
        legProgressM: uniform(rng, 0, legLengths[0] ?? 1),
        position: { x: start.x, y: start.y },
        altitudeM: kind === 'ground' ? 0 : profile.cruiseAltM,
        headingDeg: uniform(rng, 0, 360),
        groundSpeedMs: profile.cruiseMs,
        verticalSpeedMs: 0,
        batteryPct: startPct,
        batteryVoltage: packVoltage(profile.power, startPct, profile.power.idleCurrentA),
        batteryCurrentA: profile.power.idleCurrentA,
        rssiDbm: -62,
        packetLossPct: 0,
        satellites: randInt(rng, 14, 21),
        hdop: uniform(rng, 0.6, 1.0),
        mode: 'AUTO.MISSION',
        armed: true,
        lastFrameS: 0,
        frozen: false,
        breachTarget: null,
        rng: rngFromSeed(`${this.seed}:${i}`),
        noisePhase: uniform(rng, 0, Math.PI * 2),
      });
    }
    this.faults = buildFaultSchedule(rng, this.vehicles.length);
  }

  /** Fault windows for this run. Exposed so the UI can explain what it injected. */
  get faultSchedule(): readonly FaultWindow[] {
    return this.faults;
  }

  get simTimeS(): number {
    return this.timeS;
  }

  /** Advance one fixed timestep and return the new snapshot. */
  step(): FleetSnapshot {
    this.timeS = Number((this.timeS + SIM_DT_S).toFixed(3));
    this.tickCount += 1;
    for (let i = 0; i < this.vehicles.length; i += 1) {
      const vehicle = this.vehicles[i];
      if (vehicle) this.stepVehicle(vehicle, i);
    }
    return this.snapshot();
  }

  private activeFault(kind: FaultKind, index: number): number {
    let level = 0;
    for (const window of this.faults) {
      if (window.kind !== kind || window.vehicleIndex !== index) continue;
      level = Math.max(level, faultEnvelope(window, this.timeS));
    }
    return level;
  }

  private stepVehicle(v: VehicleSim, index: number): void {
    const dead = this.activeFault('UNRESPONSIVE', index);
    if (dead > 0.35) {
      // No frames decoded: the ground station keeps the last known state and
      // ages it. This is what actually drives the UNRESPONSIVE alert.
      v.frozen = true;
      return;
    }
    v.frozen = false;
    v.lastFrameS = this.timeS;

    const breach = this.activeFault('GEOFENCE_BREACH', index);
    const sag = this.activeFault('BATTERY_SAG', index);
    const gps = this.activeFault('GPS_DEGRADED', index);
    const link = this.activeFault('LINK_DROP', index);

    this.stepNavigation(v, breach);
    this.stepPower(v, sag);
    this.stepGnss(v, gps);
    this.stepLink(v, link);

    v.mode = this.modeFor(v, breach);
    v.armed = v.batteryPct > 1;
  }

  private stepNavigation(v: VehicleSim, breach: number): void {
    if (breach > 0 && !v.breachTarget) {
      // Push the vehicle towards the nearest outside-the-fence point by
      // extending its current bearing well past the boundary.
      const rad = (v.headingDeg * Math.PI) / 180;
      v.breachTarget = {
        x: v.position.x + Math.sin(rad) * 1500,
        y: v.position.y + Math.cos(rad) * 1500,
      };
    }
    if (breach === 0) v.breachTarget = null;

    const target = v.breachTarget ?? this.currentWaypoint(v);
    const wantHeading = headingTo(v.position, target);
    const turn = clamp(
      angleDelta(v.headingDeg, wantHeading),
      -v.profile.turnRateDegS * SIM_DT_S,
      v.profile.turnRateDegS * SIM_DT_S,
    );
    v.headingDeg = (v.headingDeg + turn + 360) % 360;

    const speedTarget =
      v.mode === 'AUTO.RTL' ? v.profile.cruiseMs * 1.05 : v.profile.cruiseMs;
    const wobble = 1 + 0.06 * Math.sin(this.timeS * 0.21 + v.noisePhase);
    v.groundSpeedMs = clamp(speedTarget * wobble, 0, speedTarget * 1.2);

    const rad = (v.headingDeg * Math.PI) / 180;
    const stepM = v.groundSpeedMs * SIM_DT_S;
    v.position = {
      x: v.position.x + Math.sin(rad) * stepM,
      y: v.position.y + Math.cos(rad) * stepM,
    };

    if (!v.breachTarget) {
      v.legProgressM += stepM;
      const legLength = v.legLengths[v.legIndex] ?? 1;
      if (v.legProgressM >= legLength || distance(v.position, target) < 25) {
        v.legProgressM = 0;
        v.legIndex = (v.legIndex + 1) % v.route.length;
      }
    }

    // Altitude tracks the profile cruise altitude with a slow terrain-follow ripple.
    const wantAlt =
      v.kind === 'ground'
        ? 0
        : v.profile.cruiseAltM + 14 * Math.sin(this.timeS * 0.05 + v.noisePhase);
    const climb = clamp(wantAlt - v.altitudeM, -3.5, 3.5);
    v.verticalSpeedMs = climb;
    v.altitudeM = Math.max(0, v.altitudeM + climb * SIM_DT_S);
  }

  private currentWaypoint(v: VehicleSim): Vec2 {
    if (v.mode === 'AUTO.RTL') return v.home;
    return v.route[(v.legIndex + 1) % v.route.length] ?? v.home;
  }

  private stepPower(v: VehicleSim, sag: number): void {
    const loadFactor = 1 + sag * 1.6;
    const current = packCurrent(
      v.profile.power,
      v.groundSpeedMs,
      v.verticalSpeedMs,
      loadFactor,
    );
    v.batteryCurrentA = current;
    v.batteryPct = drainBattery(v.profile.power, v.batteryPct, current, SIM_DT_S);
    const noise = gaussian(v.rng, 0, 0.012);
    v.batteryVoltage = packVoltage(v.profile.power, v.batteryPct, current) + noise;
  }

  private stepGnss(v: VehicleSim, degraded: number): void {
    const baseSats = 17 + 2 * Math.sin(this.timeS * 0.03 + v.noisePhase);
    const baseHdop = 0.8 + 0.12 * Math.sin(this.timeS * 0.07 + v.noisePhase);
    v.satellites = Math.round(clamp(baseSats - degraded * 13 + gaussian(v.rng, 0, 0.4), 0, 24));
    v.hdop = Number(clamp(baseHdop + degraded * 4.2 + gaussian(v.rng, 0, 0.03), 0.4, 9.9).toFixed(2));
  }

  private stepLink(v: VehicleSim, drop: number): void {
    const range = distance(v.position, { x: 0, y: 0 });
    // Free-space-ish path loss against a -45 dBm reference at 50 m.
    const pathLoss = 20 * Math.log10(Math.max(range, 50) / 50);
    const base = -45 - pathLoss + gaussian(v.rng, 0, 1.1);
    v.rssiDbm = Number(clamp(base - drop * 55, -120, -35).toFixed(1));
    const lossFromRssi = clamp((-85 - v.rssiDbm) * 3.5, 0, 100);
    v.packetLossPct = Number(clamp(lossFromRssi + drop * 45, 0, 100).toFixed(1));
  }

  private modeFor(v: VehicleSim, breach: number): FlightMode {
    if (v.batteryPct <= 12) return 'AUTO.LAND';
    if (v.batteryPct <= 22) return 'AUTO.RTL';
    if (breach > 0.5) return 'POSITION';
    if (v.kind === 'ground') return 'OFFBOARD';
    return 'AUTO.MISSION';
  }

  /** Materialise the immutable snapshot the UI consumes. */
  snapshot(): FleetSnapshot {
    const vehicles: VehicleState[] = this.vehicles.map((v) => {
      const telemetryAgeS = Number((this.timeS - v.lastFrameS).toFixed(2));
      const gpsFix = gpsFixFor(v.satellites, v.hdop);
      const linkQualityPct = Number(linkQualityFrom(v.rssiDbm, v.packetLossPct).toFixed(1));
      const insideGeofence = pointInPolygon(v.position, GEOFENCE);
      const travelled =
        v.legLengths.slice(0, v.legIndex).reduce((a, b) => a + b, 0) + v.legProgressM;
      const missionProgressPct = Number(
        clamp((travelled / Math.max(v.routeLength, 1)) * 100, 0, 100).toFixed(1),
      );
      const status = deriveStatus({
        telemetryAgeS,
        batteryPct: v.batteryPct,
        linkQualityPct,
        insideGeofence,
        gpsFix,
      });
      return {
        id: v.id,
        name: v.name,
        kind: v.kind,
        position: { x: Number(v.position.x.toFixed(2)), y: Number(v.position.y.toFixed(2)) },
        home: v.home,
        altitudeM: Number(v.altitudeM.toFixed(1)),
        headingDeg: Number(v.headingDeg.toFixed(1)),
        groundSpeedMs: Number(v.groundSpeedMs.toFixed(2)),
        verticalSpeedMs: Number(v.verticalSpeedMs.toFixed(2)),
        batteryPct: Number(v.batteryPct.toFixed(2)),
        batteryVoltage: Number(v.batteryVoltage.toFixed(2)),
        batteryCurrentA: Number(v.batteryCurrentA.toFixed(2)),
        batteryCells: v.profile.power.cells,
        linkRssiDbm: v.rssiDbm,
        linkQualityPct,
        packetLossPct: v.packetLossPct,
        telemetryAgeS,
        gpsFix,
        satellites: v.satellites,
        hdop: v.hdop,
        mode: v.mode,
        armed: v.armed,
        missionIndex: v.legIndex + 1,
        missionTotal: v.route.length,
        missionProgressPct,
        insideGeofence,
        status,
      };
    });
    return {
      tick: this.tickCount,
      simTimeS: this.timeS,
      wallClockMs: Date.now(),
      vehicles,
      geofence: GEOFENCE,
    };
  }
}

/** Factory kept separate so tests and hooks construct the sim the same way. */
export function createSimulation(
  seed: string = DEFAULT_SEED,
  fleetSize: number = DEFAULT_FLEET_SIZE,
): FleetSimulation {
  return new FleetSimulation(seed, fleetSize);
}
