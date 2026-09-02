import { BatteryGauge } from './BatteryGauge';
import { LinkQuality } from './LinkQuality';
import { MissionProgress } from './MissionProgress';
import { Sparkline } from './Sparkline';
import { StatusPill } from './StatusPill';
import { KIND_LABELS, degrees, metres, speed } from '../lib/format';
import type { TelemetrySample, VehicleState } from '../types/telemetry';

export interface VehicleDetailProps {
  readonly vehicle: VehicleState | null;
  readonly history: readonly TelemetrySample[];
}

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'default' | 'warn';
}

function Field({ label, value, tone = 'default' }: FieldProps): JSX.Element {
  return (
    <div className="rounded border border-line bg-sunken px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd
        className="font-mono text-sm"
        style={{ color: tone === 'warn' ? 'var(--status-warning)' : 'var(--text-primary)' }}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Detail panel for the selected vehicle: raw readouts, gauges, and three trend
 * charts built from the rolling history buffer held by the telemetry hook.
 */
export function VehicleDetail({ vehicle, history }: VehicleDetailProps): JSX.Element {
  if (!vehicle) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-line bg-panel p-6 text-center text-sm text-ink-muted">
        Select a vehicle on the map or in the table to see its telemetry.
      </div>
    );
  }

  const altitude = history.map((s) => s.altitudeM);
  const voltage = history.map((s) => s.batteryVoltage);
  const rssi = history.map((s) => s.linkRssiDbm);
  const gpsDegraded = vehicle.gpsFix === 'FIX_2D' || vehicle.gpsFix === 'NO_FIX';

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-panel p-3 scroll-thin">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">{vehicle.name}</h2>
          <p className="text-xs text-ink-muted">
            {KIND_LABELS[vehicle.kind]} · {vehicle.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={vehicle.status} />
          <span
            className="rounded border border-line px-2 py-0.5 font-mono text-xs"
            style={{ color: vehicle.armed ? 'var(--status-warning)' : 'var(--text-muted)' }}
          >
            {vehicle.armed ? 'ARMED' : 'DISARMED'}
          </span>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="Mode" value={vehicle.mode} />
        <Field label="Altitude" value={metres(vehicle.altitudeM)} />
        <Field label="Ground speed" value={speed(vehicle.groundSpeedMs)} />
        <Field label="Vertical speed" value={speed(vehicle.verticalSpeedMs, 2)} />
        <Field label="Heading" value={degrees(vehicle.headingDeg)} />
        <Field
          label="GNSS"
          value={`${vehicle.gpsFix} · ${vehicle.satellites} sv`}
          tone={gpsDegraded ? 'warn' : 'default'}
        />
        <Field label="HDOP" value={vehicle.hdop.toFixed(2)} tone={vehicle.hdop > 2.5 ? 'warn' : 'default'} />
        <Field
          label="Position"
          value={`${vehicle.position.x.toFixed(0)}, ${vehicle.position.y.toFixed(0)} m`}
        />
        <Field
          label="Geofence"
          value={vehicle.insideGeofence ? 'inside' : 'BREACH'}
          tone={vehicle.insideGeofence ? 'default' : 'warn'}
        />
      </dl>

      <BatteryGauge
        percent={vehicle.batteryPct}
        voltage={vehicle.batteryVoltage}
        currentA={vehicle.batteryCurrentA}
        cells={vehicle.batteryCells}
      />
      <LinkQuality
        qualityPct={vehicle.linkQualityPct}
        rssiDbm={vehicle.linkRssiDbm}
        packetLossPct={vehicle.packetLossPct}
        telemetryAgeS={vehicle.telemetryAgeS}
      />
      <MissionProgress
        percent={vehicle.missionProgressPct}
        index={vehicle.missionIndex}
        total={vehicle.missionTotal}
      />

      <section aria-label="Telemetry trends" className="grid gap-2">
        <Sparkline label="Altitude" unit="m" values={altitude} color="var(--accent)" />
        <Sparkline
          label="Pack voltage"
          unit="V"
          values={voltage}
          color="var(--status-nominal)"
          digits={2}
        />
        <Sparkline label="Link RSSI" unit="dBm" values={rssi} color="var(--status-warning)" digits={0} />
      </section>
    </div>
  );
}
