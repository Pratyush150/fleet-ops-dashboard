import { describe, expect, it } from 'vitest';
import { gaussian, hashSeed, mulberry32, pick, randInt, rngFromSeed, uniform } from './rng';

describe('seeding', () => {
  it('maps distinct seeds to distinct 32-bit states', () => {
    expect(hashSeed('alpha')).not.toBe(hashSeed('bravo'));
    expect(hashSeed('alpha')).toBe(hashSeed('alpha'));
    expect(hashSeed('alpha')).toBeGreaterThanOrEqual(0);
  });

  it('replays the same stream for the same seed', () => {
    const a = rngFromSeed('scenario-7');
    const b = rngFromSeed('scenario-7');
    for (let i = 0; i < 20; i += 1) expect(a()).toBe(b());
  });
});

describe('distributions', () => {
  it('stays inside the unit interval', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 2000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('respects uniform and integer bounds', () => {
    const rng = rngFromSeed('bounds');
    for (let i = 0; i < 500; i += 1) {
      const u = uniform(rng, -5, 5);
      expect(u).toBeGreaterThanOrEqual(-5);
      expect(u).toBeLessThan(5);
      const n = randInt(rng, 3, 7);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('produces a roughly zero-mean gaussian', () => {
    const rng = rngFromSeed('noise');
    let sum = 0;
    for (let i = 0; i < 5000; i += 1) sum += gaussian(rng, 0, 1);
    expect(Math.abs(sum / 5000)).toBeLessThan(0.1);
  });

  it('picks from a list and refuses an empty one', () => {
    const rng = rngFromSeed('pick');
    expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']));
    expect(() => pick(rng, [])).toThrow();
  });
});
