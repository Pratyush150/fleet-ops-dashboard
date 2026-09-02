/**
 * Battery model.
 *
 * Kept separate from the simulation loop so it can be unit tested on its own.
 * The model is deliberately simple but has the two properties that matter for a
 * ground station demo: state of charge never increases while the vehicle is
 * drawing current, and pack voltage sags under load, which is what makes a
 * "battery low" alert fire earlier on a climbing vehicle than a loitering one.
 */

import { clamp } from './math';

export interface PowerSpec {
  /** Series cell count (4S, 6S, ...). */
  readonly cells: number;
  /** Usable pack capacity in amp-hours. */
  readonly capacityAh: number;
  /** Hotel load: autopilot, companion computer, payload. Amps. */
  readonly idleCurrentA: number;
  /** Amps per m/s of ground speed. */
  readonly speedCurrentA: number;
  /** Amps per m/s of climb rate. */
  readonly climbCurrentA: number;
  /** Pack internal resistance in ohms, drives voltage sag. */
  readonly internalOhms: number;
}

/** Instantaneous pack current for a given flight condition. */
export function packCurrent(
  spec: PowerSpec,
  groundSpeedMs: number,
  verticalSpeedMs: number,
  loadFactor = 1,
): number {
  const climb = Math.max(0, verticalSpeedMs);
  const base =
    spec.idleCurrentA +
    spec.speedCurrentA * Math.abs(groundSpeedMs) +
    spec.climbCurrentA * climb;
  return Math.max(0, base * loadFactor);
}

/**
 * Open-circuit cell voltage for a state of charge, as a piecewise-linear curve
 * with the usual lithium plateau between roughly 20% and 80%.
 */
export function cellOpenCircuitVoltage(socPct: number): number {
  const soc = clamp(socPct, 0, 100);
  if (soc <= 5) return 3.2 + (soc / 5) * 0.35;
  if (soc <= 20) return 3.55 + ((soc - 5) / 15) * 0.15;
  if (soc <= 80) return 3.7 + ((soc - 20) / 60) * 0.35;
  return 4.05 + ((soc - 80) / 20) * 0.15;
}

/** Terminal pack voltage including sag from internal resistance. */
export function packVoltage(spec: PowerSpec, socPct: number, currentA: number): number {
  const open = cellOpenCircuitVoltage(socPct) * spec.cells;
  return Math.max(0, open - currentA * spec.internalOhms);
}

/**
 * Advance state of charge by `dtS` seconds at `currentA`.
 *
 * Monotonic by construction: the returned value is never above `socPct` for a
 * non-negative current, and never below zero.
 */
export function drainBattery(
  spec: PowerSpec,
  socPct: number,
  currentA: number,
  dtS: number,
): number {
  if (dtS <= 0) return clamp(socPct, 0, 100);
  const drawnAh = (Math.max(0, currentA) * dtS) / 3600;
  const drainedPct = (drawnAh / spec.capacityAh) * 100;
  return clamp(socPct - drainedPct, 0, 100);
}

/** Remaining endurance in seconds at the current draw, or Infinity at zero draw. */
export function estimateEnduranceS(
  spec: PowerSpec,
  socPct: number,
  currentA: number,
): number {
  if (currentA <= 0) return Number.POSITIVE_INFINITY;
  const remainingAh = (clamp(socPct, 0, 100) / 100) * spec.capacityAh;
  return (remainingAh / currentA) * 3600;
}
