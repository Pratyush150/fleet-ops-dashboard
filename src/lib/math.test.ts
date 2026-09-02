import { describe, expect, it } from 'vitest';
import { angleDelta, clamp, distance, headingTo, lerp, pointInPolygon, polygonCentroid } from './math';

const SQUARE = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
];

const CONCAVE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 5, y: 4 },
  { x: 0, y: 10 },
];

describe('clamp and lerp', () => {
  it('clamps to both bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0.25)).toBeCloseTo(2.5);
    expect(lerp(-4, 4, 0.5)).toBeCloseTo(0);
  });
});

describe('bearings', () => {
  it('reports compass headings with north as zero', () => {
    expect(headingTo({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(0);
    expect(headingTo({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(90);
    expect(headingTo({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(180);
    expect(headingTo({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(270);
  });

  it('takes the short way round the compass', () => {
    expect(angleDelta(350, 10)).toBeCloseTo(20);
    expect(angleDelta(10, 350)).toBeCloseTo(-20);
    expect(Math.abs(angleDelta(0, 180))).toBeCloseTo(180);
  });

  it('measures euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });
});

describe('pointInPolygon', () => {
  it('accepts interior points of a convex polygon', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, SQUARE)).toBe(true);
    expect(pointInPolygon({ x: 9.5, y: -9.5 }, SQUARE)).toBe(true);
  });

  it('rejects exterior points', () => {
    expect(pointInPolygon({ x: 11, y: 0 }, SQUARE)).toBe(false);
    expect(pointInPolygon({ x: 0, y: -40 }, SQUARE)).toBe(false);
  });

  it('handles a concave notch', () => {
    // Directly under the notch: inside the bounding box but outside the shape.
    expect(pointInPolygon({ x: 5, y: 8 }, CONCAVE)).toBe(false);
    expect(pointInPolygon({ x: 5, y: 2 }, CONCAVE)).toBe(true);
  });

  it('rejects degenerate polygons', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });
});

describe('polygonCentroid', () => {
  it('averages the vertices', () => {
    const c = polygonCentroid(SQUARE);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
  });

  it('returns the origin for an empty polygon', () => {
    expect(polygonCentroid([])).toEqual({ x: 0, y: 0 });
  });
});
