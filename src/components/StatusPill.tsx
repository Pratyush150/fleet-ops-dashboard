import { STATUS_LABELS, STATUS_TOKENS } from '../lib/format';
import type { VehicleStatus } from '../types/telemetry';

export interface StatusPillProps {
  readonly status: VehicleStatus;
  readonly compact?: boolean;
}

/**
 * Status is never communicated by colour alone: the pill always carries the
 * word as well, so it survives greyscale printing and colour-vision deficits.
 */
export function StatusPill({ status, compact = false }: StatusPillProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-raised ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      } font-medium text-ink`}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: STATUS_TOKENS[status] }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
