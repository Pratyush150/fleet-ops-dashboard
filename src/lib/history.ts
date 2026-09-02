/**
 * Fixed-capacity ring buffer for rolling telemetry history.
 *
 * The trend charts need the last N samples per vehicle and nothing more. A
 * growing array plus `slice()` would allocate on every tick for every vehicle,
 * so the buffer overwrites in place and only materialises an array when a chart
 * actually asks for one.
 */
export class RingBuffer<T> {
  private readonly items: T[] = [];
  private cursor = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`RingBuffer capacity must be a positive integer, got ${capacity}`);
    }
  }

  get length(): number {
    return this.items.length;
  }

  push(item: T): void {
    if (this.items.length < this.capacity) {
      this.items.push(item);
      this.cursor = this.items.length % this.capacity;
      return;
    }
    this.items[this.cursor] = item;
    this.cursor = (this.cursor + 1) % this.capacity;
  }

  /** Oldest-first copy. */
  toArray(): T[] {
    if (this.items.length < this.capacity) return this.items.slice();
    return [...this.items.slice(this.cursor), ...this.items.slice(0, this.cursor)];
  }

  last(): T | undefined {
    if (this.items.length === 0) return undefined;
    const index = (this.cursor - 1 + this.items.length) % this.items.length;
    return this.items[index];
  }

  clear(): void {
    this.items.length = 0;
    this.cursor = 0;
  }
}
