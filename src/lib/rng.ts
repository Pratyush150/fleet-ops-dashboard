/**
 * Small deterministic PRNG utilities.
 *
 * The whole demo has to be reproducible from a seed string, so nothing in the
 * simulation is allowed to call `Math.random()`. `mulberry32` is used because
 * it is 32-bit, branch-free and passes enough of the usual smoke tests for a
 * telemetry mock while staying readable.
 */

export type Rng = () => number;

/** FNV-1a over a string, so a human-typed seed maps to a 32-bit state. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32. Returns a function producing floats in [0, 1). */
export function mulberry32(state: number): Rng {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: build an RNG straight from a seed string. */
export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashSeed(seed));
}

/** Uniform float in [min, max). */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

/**
 * Box-Muller normal deviate. Used for sensor noise so that RSSI and voltage
 * jitter look like measurement noise rather than a uniform buzz.
 */
export function gaussian(rng: Rng, mean = 0, stdDev = 1): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const mag = Math.sqrt(-2 * Math.log(u1));
  return mean + stdDev * mag * Math.cos(2 * Math.PI * u2);
}

/** Pick one element. Throws on an empty list so callers cannot silently get undefined. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick() index out of range');
  return item;
}
