import { STATUS_TOKENS } from '../lib/format';
import type { VehicleState } from '../types/telemetry';

export interface VehicleMarkerProps {
  readonly vehicle: VehicleState;
  readonly selected: boolean;
  readonly scale: number;
  readonly onSelect: (id: string) => void;
}

/**
 * One vehicle on the map: a heading arrow plus a body whose shape encodes the
 * airframe class (triangle for multirotor, swept arrow for VTOL, square for
 * ground). Shape carries the type, colour carries the status.
 *
 * `scale` is metres-per-pixel derived from the viewport, so markers keep a
 * constant on-screen size while the map zooms.
 */
export function VehicleMarker({
  vehicle,
  selected,
  scale,
  onSelect,
}: VehicleMarkerProps): JSX.Element {
  const color = STATUS_TOKENS[vehicle.status];
  const size = 9 * scale;
  const body =
    vehicle.kind === 'ground'
      ? `M ${-size * 0.8} ${-size * 0.8} H ${size * 0.8} V ${size * 0.8} H ${-size * 0.8} Z`
      : vehicle.kind === 'vtol'
        ? `M 0 ${-size * 1.4} L ${size} ${size} L 0 ${size * 0.45} L ${-size} ${size} Z`
        : `M 0 ${-size * 1.2} L ${size * 0.9} ${size} L ${-size * 0.9} ${size} Z`;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${vehicle.name}, ${vehicle.kind}, status ${vehicle.status}, battery ${vehicle.batteryPct.toFixed(0)} percent`}
      aria-pressed={selected}
      className="cursor-pointer"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(vehicle.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onSelect(vehicle.id);
        }
      }}
      transform={`translate(${vehicle.position.x} ${-vehicle.position.y})`}
    >
      {selected ? (
        <circle
          r={size * 2.6}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeDasharray="6 4"
        />
      ) : null}
      {/* Invisible hit area so small markers stay clickable and focusable. */}
      <circle r={size * 2.2} fill="transparent" />
      <g transform={`rotate(${vehicle.headingDeg})`}>
        <path
          d={body}
          fill={color}
          fillOpacity={vehicle.status === 'offline' ? 0.35 : 0.9}
          stroke="var(--bg-app)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0"
          y1={-size * 1.2}
          x2="0"
          y2={-size * 2.4}
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <text
        x={size * 2.0}
        y={size * 0.6}
        fontSize={11 * scale}
        fill="var(--text-muted)"
        style={{ userSelect: 'none' }}
      >
        {vehicle.name}
      </text>
    </g>
  );
}
