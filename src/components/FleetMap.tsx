import { useMemo } from 'react';
import { useElementSize } from '../hooks/useElementSize';
import { useMapViewport } from '../hooks/useMapViewport';
import { VehicleMarker } from './VehicleMarker';
import type { FleetSnapshot, Vec2 } from '../types/telemetry';

export interface FleetMapProps {
  readonly snapshot: FleetSnapshot;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly trailFor: (vehicleId: string) => Vec2[];
}

const GRID_STEP_M = 200;
const INITIAL_VIEW = { cx: 0, cy: 30, spanX: 2400 } as const;

function gridLines(
  cx: number,
  cy: number,
  spanX: number,
  spanY: number,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const startX = Math.floor((cx - spanX / 2) / GRID_STEP_M) * GRID_STEP_M;
  const startY = Math.floor((cy - spanY / 2) / GRID_STEP_M) * GRID_STEP_M;
  for (let x = startX; x <= cx + spanX / 2; x += GRID_STEP_M) xs.push(x);
  for (let y = startY; y <= cy + spanY / 2; y += GRID_STEP_M) ys.push(y);
  return { xs, ys };
}

/**
 * Top-down operations map, drawn as plain SVG over the local ENU frame.
 *
 * There is no tile server and no map library: the world is a metric coordinate
 * plane, the geofence is a polygon in that plane, and pan/zoom is viewBox
 * arithmetic in `useMapViewport`. That keeps the demo fully offline.
 */
export function FleetMap({
  snapshot,
  selectedId,
  onSelect,
  trailFor,
}: FleetMapProps): JSX.Element {
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const view = useMapViewport(INITIAL_VIEW, size);

  const aspect = size.height > 0 && size.width > 0 ? size.height / size.width : 0.62;
  const spanY = view.viewport.spanX * aspect;
  const scale = view.viewport.spanX / Math.max(size.width, 1);

  const fencePoints = useMemo(
    () => snapshot.geofence.map((p) => `${p.x},${-p.y}`).join(' '),
    [snapshot.geofence],
  );
  const { xs, ys } = gridLines(view.viewport.cx, view.viewport.cy, view.viewport.spanX, spanY);

  return (
    <div ref={sizeRef} className="relative h-full w-full overflow-hidden rounded-lg bg-sunken">
      <svg
        className={`h-full w-full touch-none ${view.isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        viewBox={view.viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="Fleet map. Drag to pan, scroll to zoom, click a vehicle to select it."
        onPointerDown={view.onPointerDown}
        onPointerMove={view.onPointerMove}
        onPointerUp={view.onPointerUp}
        onPointerCancel={view.onPointerUp}
        onWheel={view.onWheel}
      >
        <g aria-hidden="true">
          {xs.map((x) => (
            <line
              key={`x${x}`}
              x1={x}
              y1={-view.viewport.cy - spanY}
              x2={x}
              y2={-view.viewport.cy + spanY}
              stroke="var(--grid-line)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {ys.map((y) => (
            <line
              key={`y${y}`}
              x1={view.viewport.cx - view.viewport.spanX}
              y1={-y}
              x2={view.viewport.cx + view.viewport.spanX}
              y2={-y}
              stroke="var(--grid-line)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <polygon
          points={fencePoints}
          fill="var(--accent)"
          fillOpacity="0.05"
          stroke="var(--accent)"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeDasharray="10 6"
          vectorEffect="non-scaling-stroke"
        />

        {snapshot.vehicles.map((v) => (
          <g key={`home-${v.id}`} aria-hidden="true">
            <path
              d={`M ${v.home.x - 5 * scale} ${-v.home.y} h ${10 * scale} M ${v.home.x} ${-v.home.y - 5 * scale} v ${10 * scale}`}
              stroke="var(--text-faint)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {snapshot.vehicles.map((v) => {
          const trail = trailFor(v.id);
          if (trail.length < 2) return null;
          return (
            <polyline
              key={`trail-${v.id}`}
              aria-hidden="true"
              points={trail.map((p) => `${p.x},${-p.y}`).join(' ')}
              fill="none"
              stroke="var(--trail)"
              strokeOpacity={v.id === selectedId ? 0.85 : 0.28}
              strokeWidth={v.id === selectedId ? 2 : 1.2}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {snapshot.vehicles.map((v) => (
          <VehicleMarker
            key={v.id}
            vehicle={v}
            selected={v.id === selectedId}
            scale={scale}
            onSelect={onSelect}
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
        <p className="pointer-events-none rounded bg-panel/80 px-2 py-1 font-mono text-[11px] text-ink-muted">
          {`${(view.viewport.spanX / 1000).toFixed(2)} km across`} · grid {GRID_STEP_M} m
        </p>
        <div className="pointer-events-auto flex gap-1">
          <button
            type="button"
            onClick={() => view.zoomBy(1 / 1.4)}
            className="rounded border border-line bg-panel px-2 py-1 text-sm text-ink hover:bg-raised"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => view.zoomBy(1.4)}
            className="rounded border border-line bg-panel px-2 py-1 text-sm text-ink hover:bg-raised"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={view.resetView}
            className="rounded border border-line bg-panel px-2 py-1 text-xs text-ink hover:bg-raised"
          >
            Reset view
          </button>
        </div>
      </div>
    </div>
  );
}
