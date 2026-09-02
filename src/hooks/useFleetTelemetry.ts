import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertEngine } from '../lib/alerts';
import { DEFAULT_SEED, SIM_DT_S, createSimulation } from '../lib/fleet-sim';
import { RingBuffer } from '../lib/history';
import type { Alert } from '../types/alerts';
import type { FleetSnapshot, TelemetrySample, Vec2 } from '../types/telemetry';

/** Samples retained per vehicle for the trend charts (~2.5 minutes at 2 Hz). */
export const HISTORY_CAPACITY = 300;
/** Map trail points retained per vehicle. */
export const TRAIL_CAPACITY = 120;
/** Real-time interval between ticks at 1x. */
const TICK_INTERVAL_MS = 500;

export type SpeedMultiplier = 0.5 | 1 | 4;

export interface TelemetryController {
  readonly snapshot: FleetSnapshot;
  readonly alerts: readonly Alert[];
  readonly running: boolean;
  readonly speed: SpeedMultiplier;
  readonly seed: string;
  readonly historyFor: (vehicleId: string) => TelemetrySample[];
  readonly trailFor: (vehicleId: string) => Vec2[];
  readonly setRunning: (running: boolean) => void;
  readonly setSpeed: (speed: SpeedMultiplier) => void;
  readonly applySeed: (seed: string) => void;
  readonly acknowledge: (id: string) => void;
  readonly acknowledgeAll: () => void;
}

/**
 * Drives the simulation on a wall-clock interval and keeps the derived state
 * the UI needs: alert engine, per-vehicle history buffers and map trails.
 *
 * The interval only decides *when* to advance; each advance is a fixed
 * `SIM_DT_S` step, which is what keeps a seed reproducible regardless of how
 * long the tab was throttled in the background.
 */
export function useFleetTelemetry(initialSeed: string = DEFAULT_SEED): TelemetryController {
  const [seed, setSeed] = useState(initialSeed);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<SpeedMultiplier>(1);

  const simRef = useRef(createSimulation(seed));
  const engineRef = useRef(new AlertEngine());
  const historyRef = useRef(new Map<string, RingBuffer<TelemetrySample>>());
  const trailRef = useRef(new Map<string, RingBuffer<Vec2>>());

  const [snapshot, setSnapshot] = useState<FleetSnapshot>(() => simRef.current.snapshot());
  const [alerts, setAlerts] = useState<readonly Alert[]>([]);

  const record = useCallback((next: FleetSnapshot) => {
    for (const vehicle of next.vehicles) {
      let history = historyRef.current.get(vehicle.id);
      if (!history) {
        history = new RingBuffer<TelemetrySample>(HISTORY_CAPACITY);
        historyRef.current.set(vehicle.id, history);
      }
      history.push({
        t: next.simTimeS,
        altitudeM: vehicle.altitudeM,
        batteryVoltage: vehicle.batteryVoltage,
        linkRssiDbm: vehicle.linkRssiDbm,
      });

      let trail = trailRef.current.get(vehicle.id);
      if (!trail) {
        trail = new RingBuffer<Vec2>(TRAIL_CAPACITY);
        trailRef.current.set(vehicle.id, trail);
      }
      trail.push(vehicle.position);
    }
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const intervalMs = Math.max(60, TICK_INTERVAL_MS / speed);
    const handle = window.setInterval(() => {
      const next = simRef.current.step();
      record(next);
      engineRef.current.update(next);
      setSnapshot(next);
      // `list()` only changes identity when the feed actually changed, so this
      // is a no-op render on quiet ticks.
      setAlerts(engineRef.current.list());
    }, intervalMs);
    return () => window.clearInterval(handle);
  }, [running, speed, record]);

  const applySeed = useCallback(
    (nextSeed: string) => {
      const trimmed = nextSeed.trim() || DEFAULT_SEED;
      setSeed(trimmed);
      simRef.current = createSimulation(trimmed);
      engineRef.current.reset();
      historyRef.current.clear();
      trailRef.current.clear();
      const fresh = simRef.current.snapshot();
      record(fresh);
      setSnapshot(fresh);
      setAlerts([]);
    },
    [record],
  );

  const acknowledge = useCallback((id: string) => {
    engineRef.current.acknowledge(id);
    setAlerts(engineRef.current.list());
  }, []);

  const acknowledgeAll = useCallback(() => {
    engineRef.current.acknowledgeAll();
    setAlerts(engineRef.current.list());
  }, []);

  const historyFor = useCallback(
    (vehicleId: string): TelemetrySample[] => historyRef.current.get(vehicleId)?.toArray() ?? [],
    [],
  );

  const trailFor = useCallback(
    (vehicleId: string): Vec2[] => trailRef.current.get(vehicleId)?.toArray() ?? [],
    [],
  );

  return useMemo(
    () => ({
      snapshot,
      alerts,
      running,
      speed,
      seed,
      historyFor,
      trailFor,
      setRunning,
      setSpeed,
      applySeed,
      acknowledge,
      acknowledgeAll,
    }),
    [
      snapshot,
      alerts,
      running,
      speed,
      seed,
      historyFor,
      trailFor,
      applySeed,
      acknowledge,
      acknowledgeAll,
    ],
  );
}

export { SIM_DT_S };
