import { useEffect, useState } from 'react';
import type { SpeedMultiplier } from '../hooks/useFleetTelemetry';
import { clockFromSeconds } from '../lib/format';

export interface PlaybackControlsProps {
  readonly running: boolean;
  readonly speed: SpeedMultiplier;
  readonly seed: string;
  readonly simTimeS: number;
  readonly tick: number;
  readonly onRunningChange: (running: boolean) => void;
  readonly onSpeedChange: (speed: SpeedMultiplier) => void;
  readonly onSeedApply: (seed: string) => void;
}

const SPEEDS: readonly SpeedMultiplier[] = [0.5, 1, 4];

/**
 * Playback transport for the simulation.
 *
 * The seed field is the interesting one: applying a seed rebuilds the fleet,
 * the mission set and the fault schedule from scratch, so a scenario can be
 * handed to someone else as a single string and replayed exactly.
 */
export function PlaybackControls({
  running,
  speed,
  seed,
  simTimeS,
  tick,
  onRunningChange,
  onSpeedChange,
  onSeedApply,
}: PlaybackControlsProps): JSX.Element {
  const [draftSeed, setDraftSeed] = useState(seed);
  useEffect(() => setDraftSeed(seed), [seed]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onRunningChange(!running)}
        aria-pressed={running}
        className="rounded border border-line bg-raised px-3 py-1 text-xs font-medium text-ink hover:bg-panel"
      >
        {running ? 'Pause' : 'Resume'}
      </button>

      <div className="flex items-center gap-1" role="group" aria-label="Simulation speed">
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={speed === option}
            onClick={() => onSpeedChange(option)}
            className={`rounded border px-2 py-1 font-mono text-xs ${
              speed === option
                ? 'border-accent bg-accent-soft text-ink'
                : 'border-line bg-raised text-ink-muted hover:text-ink'
            }`}
          >
            {option}x
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          onSeedApply(draftSeed);
        }}
      >
        <label className="text-xs text-ink-muted" htmlFor="seed-input">
          Seed
        </label>
        <input
          id="seed-input"
          value={draftSeed}
          onChange={(event) => setDraftSeed(event.target.value)}
          spellCheck={false}
          className="w-28 rounded border border-line bg-raised px-2 py-1 font-mono text-xs text-ink"
        />
        <button
          type="submit"
          className="rounded border border-line bg-raised px-2 py-1 text-xs text-ink hover:bg-panel"
        >
          Apply
        </button>
      </form>

      <p className="font-mono text-xs text-ink-faint">
        T+{clockFromSeconds(simTimeS)} · tick {tick}
      </p>
    </div>
  );
}
