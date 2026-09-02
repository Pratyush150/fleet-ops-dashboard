import { describe, expect, it } from 'vitest';
import { RingBuffer } from './history';

describe('RingBuffer', () => {
  it('rejects an invalid capacity', () => {
    expect(() => new RingBuffer<number>(0)).toThrow();
    expect(() => new RingBuffer<number>(2.5)).toThrow();
  });

  it('grows up to capacity', () => {
    const buffer = new RingBuffer<number>(4);
    buffer.push(1);
    buffer.push(2);
    expect(buffer.length).toBe(2);
    expect(buffer.toArray()).toEqual([1, 2]);
  });

  it('caps at capacity and keeps the newest samples in order', () => {
    const buffer = new RingBuffer<number>(3);
    for (let i = 1; i <= 10; i += 1) buffer.push(i);
    expect(buffer.length).toBe(3);
    expect(buffer.toArray()).toEqual([8, 9, 10]);
  });

  it('reports the most recent sample before and after wrapping', () => {
    const buffer = new RingBuffer<string>(2);
    expect(buffer.last()).toBeUndefined();
    buffer.push('a');
    expect(buffer.last()).toBe('a');
    buffer.push('b');
    buffer.push('c');
    expect(buffer.last()).toBe('c');
  });

  it('clears back to empty', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    buffer.clear();
    expect(buffer.length).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });
});
