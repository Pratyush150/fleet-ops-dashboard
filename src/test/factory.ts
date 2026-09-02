/** Test-only builders. Not imported by the application bundle. */

import type { FleetSnapshot, VehicleState } from '../types/telemetry';

export function makeVehicle(overrides: Partial<VehicleState> = {}): VehicleState {
  const base: VehicleState = {
    id: 'v01',
    name: 'MC-101',
    kind: 'quadrotor',
    position: { x: 0, y: 0 },
    home: { x: 0, y: 0 },
    altitudeM: 50,
    headingDeg: 90,
    groundSpeedMs: 10,
    verticalSpeedMs: 0,
    batteryPct: 80,
    batteryVoltage: 23.4,
    batteryCurrentA: 20,
    batteryCells: 6,
    linkRssiDbm: -60,
    linkQualityPct: 82,
    packetLossPct: 0,
    telemetryAgeS: 0,
    gpsFix: 'RTK_FIXED',
    satellites: 18,
    hdop: 0.7,
    mode: 'AUTO.MISSION',
    armed: true,
    missionIndex: 2,
    missionTotal: 6,
    missionProgressPct: 30,
    insideGeofence: true,
    status: 'nominal',
  };
  return { ...base, ...overrides };
}

export function makeSnapshot(
  vehicles: readonly VehicleState[],
  simTimeS: number,
): FleetSnapshot {
  return {
    tick: Math.round(simTimeS * 2),
    simTimeS,
    wallClockMs: 1_767_000_000_000 + simTimeS * 1000,
    vehicles,
    geofence: [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ],
  };
}
