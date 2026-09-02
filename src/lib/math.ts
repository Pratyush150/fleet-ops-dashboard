/** Geometry and numeric helpers shared by the simulation and the map. */

import type { Vec2 } from '../types/telemetry';

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation, `t` is not clamped by design (used for extrapolation). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Compass heading in degrees (0 = +y / north, 90 = +x / east). */
export function headingTo(from: Vec2, to: Vec2): number {
  const deg = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Shortest signed angular difference `to - from`, in (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

/**
 * Ray-casting point-in-polygon test.
 *
 * The polygon is treated as closed; the caller does not repeat the first
 * vertex. Points exactly on an edge are not guaranteed either way, which
 * matches how a real geofence check behaves at the boundary — that is why the
 * geofence alert has hysteresis on top of it.
 */
export function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    const straddles = a.y > point.y !== b.y > point.y;
    if (!straddles) continue;
    const xCross = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (point.x < xCross) inside = !inside;
  }
  return inside;
}

/** Signed distance-ish helper: how far inside/outside the polygon centroid axis. */
export function polygonCentroid(polygon: readonly Vec2[]): Vec2 {
  if (polygon.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of polygon) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / polygon.length, y: sy / polygon.length };
}
