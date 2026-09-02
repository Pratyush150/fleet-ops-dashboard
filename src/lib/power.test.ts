import { describe, expect, it } from 'vitest';
import {
  cellOpenCircuitVoltage,
  drainBattery,
  estimateEnduranceS,
  packCurrent,
  packVoltage,
  type PowerSpec,
} from './power';

const SPEC: PowerSpec = {
  cells: 6,
  capacityAh: 16,
  idleCurrentA: 3,
  speedCurrentA: 2,
  climbCurrentA: 6,
  internalOhms: 0.02,
};

describe('packCurrent', () => {
  it('adds speed and climb terms to the hotel load', () => {
    expect(packCurrent(SPEC, 0, 0)).toBeCloseTo(3);
    expect(packCurrent(SPEC, 10, 0)).toBeCloseTo(23);
    expect(packCurrent(SPEC, 10, 2)).toBeCloseTo(35);
  });

  it('ignores descent as a power cost and scales with the load factor', () => {
    expect(packCurrent(SPEC, 0, -5)).toBeCloseTo(3);
    expect(packCurrent(SPEC, 0, 0, 2)).toBeCloseTo(6);
  });
});

describe('drainBattery', () => {
  it('is monotonically non-increasing under load', () => {
    let soc = 100;
    for (let i = 0; i < 500; i += 1) {
      const next = drainBattery(SPEC, soc, 30, 0.5);
      expect(next).toBeLessThanOrEqual(soc);
      soc = next;
    }
    expect(soc).toBeLessThan(100);
  });

  it('drains faster at a higher current', () => {
    const light = drainBattery(SPEC, 80, 10, 60);
    const heavy = drainBattery(SPEC, 80, 40, 60);
    expect(heavy).toBeLessThan(light);
  });

  it('never goes below zero', () => {
    expect(drainBattery(SPEC, 1, 200, 3600)).toBe(0);
  });

  it('is a no-op for a non-positive timestep', () => {
    expect(drainBattery(SPEC, 55, 30, 0)).toBe(55);
    expect(drainBattery(SPEC, 55, 30, -1)).toBe(55);
  });
});

describe('voltage model', () => {
  it('has a monotonic open-circuit curve', () => {
    let previous = -Infinity;
    for (let soc = 0; soc <= 100; soc += 5) {
      const v = cellOpenCircuitVoltage(soc);
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
    expect(cellOpenCircuitVoltage(100)).toBeCloseTo(4.2, 2);
  });

  it('sags under current', () => {
    const idle = packVoltage(SPEC, 70, 0);
    const loaded = packVoltage(SPEC, 70, 60);
    expect(loaded).toBeLessThan(idle);
    expect(idle - loaded).toBeCloseTo(60 * SPEC.internalOhms, 5);
  });

  it('clamps the state of charge to the valid range', () => {
    expect(packVoltage(SPEC, 140, 0)).toBeCloseTo(packVoltage(SPEC, 100, 0));
  });
});

describe('estimateEnduranceS', () => {
  it('scales inversely with current', () => {
    const slow = estimateEnduranceS(SPEC, 100, 16);
    expect(slow).toBeCloseTo(3600);
    expect(estimateEnduranceS(SPEC, 100, 32)).toBeCloseTo(1800);
  });

  it('is unbounded at zero draw', () => {
    expect(estimateEnduranceS(SPEC, 50, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
