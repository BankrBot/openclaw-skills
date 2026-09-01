// Deterministic, seedable PRNG so battles are reproducible from a seed.
// mulberry32 — small, fast, good enough for simulation.

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // float in [0, 1)
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // float in [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // integer in [min, max] inclusive
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  // true with probability p
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  // gaussian-ish via central limit (sum of 3 uniforms), mean 0
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }
}
