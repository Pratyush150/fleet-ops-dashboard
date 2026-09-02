import { useEffect, useMemo, useState } from 'react';
import { AlertFeed } from './components/AlertFeed';
import { FleetFilters } from './components/FleetFilters';
import { FleetMap } from './components/FleetMap';
import { FleetTable } from './components/FleetTable';
import { PlaybackControls } from './components/PlaybackControls';
import { SummaryStrip } from './components/SummaryStrip';
import { ThemeToggle } from './components/ThemeToggle';
import { VehicleDetail } from './components/VehicleDetail';
import { useFleetTelemetry } from './hooks/useFleetTelemetry';
import { useTheme } from './hooks/useTheme';
import {
  DEFAULT_FILTER,
  applyTableView,
  summariseFleet,
  type FleetFilter,
  type SortState,
} from './lib/fleet-table';
import type { AlertFilter } from './types/alerts';

const INITIAL_SORT: SortState = { key: 'status', direction: 'asc' };

/**
 * Application shell.
 *
 * State lives here and flows down: one telemetry controller, one selection,
 * one table view state, one alert filter. Components stay presentational so
 * the logic they render stays unit testable in `src/lib`.
 */
export default function App(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const telemetry = useFleetTelemetry();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FleetFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<SortState>(INITIAL_SORT);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('active');

  const { vehicles } = telemetry.snapshot;

  useEffect(() => {
    if (selectedId === null && vehicles.length > 0) {
      setSelectedId(vehicles[0]?.id ?? null);
    }
  }, [selectedId, vehicles]);

  const rows = useMemo(() => applyTableView(vehicles, filter, sort), [vehicles, filter, sort]);
  const summary = useMemo(() => summariseFleet(vehicles), [vehicles]);
  const selected = vehicles.find((v) => v.id === selectedId) ?? null;
  const history = selectedId ? telemetry.historyFor(selectedId) : [];

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink">
      <a
        href="#fleet-table"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-panel focus:px-3 focus:py-2"
      >
        Skip to fleet table
      </a>

      <header className="border-b border-line bg-panel px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="mr-auto">
            <h1 className="text-base font-semibold tracking-tight text-ink">
              Fleet Ops Dashboard
            </h1>
            <p className="text-[11px] text-ink-muted">
              Simulated telemetry · {vehicles.length} vehicles · seed{' '}
              <span className="font-mono">{telemetry.seed}</span>
            </p>
          </div>
          <PlaybackControls
            running={telemetry.running}
            speed={telemetry.speed}
            seed={telemetry.seed}
            simTimeS={telemetry.snapshot.simTimeS}
            tick={telemetry.snapshot.tick}
            onRunningChange={telemetry.setRunning}
            onSpeedChange={telemetry.setSpeed}
            onSeedApply={telemetry.applySeed}
          />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 p-3">
        <SummaryStrip summary={summary} alerts={telemetry.alerts} />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
          <section
            aria-label="Fleet map"
            className="h-[22rem] rounded-lg border border-line bg-panel p-1 sm:h-[26rem] xl:h-[32rem]"
          >
            <FleetMap
              snapshot={telemetry.snapshot}
              selectedId={selectedId}
              onSelect={setSelectedId}
              trailFor={telemetry.trailFor}
            />
          </section>

          <aside
            aria-label="Selected vehicle"
            className="min-h-[22rem] xl:h-[32rem]"
          >
            <VehicleDetail vehicle={selected} history={history} />
          </aside>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
          <section
            id="fleet-table"
            aria-label="Fleet table"
            className="rounded-lg border border-line bg-panel p-3"
          >
            <div className="mb-2">
              <FleetFilters
                filter={filter}
                onChange={setFilter}
                resultCount={rows.length}
                totalCount={vehicles.length}
              />
            </div>
            <FleetTable
              vehicles={rows}
              sort={sort}
              onSortChange={setSort}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>

          <div className="h-[24rem] xl:h-auto">
            <AlertFeed
              alerts={telemetry.alerts}
              filter={alertFilter}
              onFilterChange={setAlertFilter}
              onAcknowledge={telemetry.acknowledge}
              onAcknowledgeAll={telemetry.acknowledgeAll}
              onSelectVehicle={setSelectedId}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-line px-3 py-2 text-[11px] text-ink-muted">
        Telemetry is generated locally by the built-in simulator. No vehicles, radios or
        network services are involved.
      </footer>
    </div>
  );
}
