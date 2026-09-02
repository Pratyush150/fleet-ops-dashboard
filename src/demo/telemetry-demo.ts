/**
 * Headless telemetry demo.
 *
 * Runs the same simulation and the same alert engine the browser UI uses, and
 * prints the resulting fleet state and derived alerts to stdout. No browser, no
 * network, no hardware. Useful for checking that a seed reproduces a scenario
 * before handing that seed to someone else.
 *
 *   npm run demo            # default seed
 *   npm run demo -- my-seed # any seed string
 */

import { ALERT_LABELS, AlertEngine } from '../lib/alerts';
import { DEFAULT_SEED, SIM_DT_S, createSimulation } from '../lib/fleet-sim';
import { clockFromSeconds } from '../lib/format';

const RUN_SECONDS = 600;

// Read argv without pulling in Node type definitions, so the demo type checks
// under the same DOM-flavoured config as the rest of the app.
const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? [];
const seed = argv[2] ?? DEFAULT_SEED;

const sim = createSimulation(seed);
const engine = new AlertEngine();

console.log(`seed=${seed}  dt=${SIM_DT_S}s  horizon=${RUN_SECONDS}s`);
console.log('\ninjected fault schedule');
for (const fault of sim.faultSchedule.slice(0, 5)) {
  console.log(
    `  ${fault.kind.padEnd(16)} vehicle #${String(fault.vehicleIndex).padStart(2)} ` +
      `T+${clockFromSeconds(fault.startS)} .. T+${clockFromSeconds(fault.endS)}`,
  );
}

const ticks = Math.round(RUN_SECONDS / SIM_DT_S);
let snapshot = sim.snapshot();
for (let i = 0; i < ticks; i += 1) {
  snapshot = sim.step();
  engine.update(snapshot);
}

console.log(`\nfleet at T+${clockFromSeconds(snapshot.simTimeS)}`);
console.log('  vehicle   type       status    batt%  link%  alt m  mode');
for (const v of snapshot.vehicles) {
  console.log(
    `  ${v.name.padEnd(9)} ${v.kind.padEnd(10)} ${v.status.padEnd(9)} ` +
      `${v.batteryPct.toFixed(0).padStart(5)}  ${v.linkQualityPct.toFixed(0).padStart(5)}  ` +
      `${v.altitudeM.toFixed(0).padStart(5)}  ${v.mode}`,
  );
}

console.log('\nalerts derived from that telemetry (newest first)');
for (const alert of engine.list().slice(0, 12)) {
  const state = alert.clearedAtS === null ? 'active ' : 'cleared';
  console.log(
    `  T+${clockFromSeconds(alert.raisedAtS)}  ${alert.severity.padEnd(8)} ${state}  ` +
      `${alert.vehicleName.padEnd(9)} ${ALERT_LABELS[alert.kind].padEnd(17)} ${alert.message}`,
  );
}
if (engine.list().length === 0) console.log('  (none)');
