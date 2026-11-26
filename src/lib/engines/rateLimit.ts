/** Bounded sliding-window limiter for single-instance development. */
export class MemoryRateLimiter {
  private buckets = new Map<string, { timestamps: number[]; expires: number }>();
  constructor(private capacity = 50_000) {}
  limited(key: string, max: number, windowMs: number, now = Date.now()): boolean {
    const times = (this.buckets.get(key)?.timestamps ?? []).filter((t) => t > now - windowMs);
    if (times.length >= max) return true;
    if (!this.buckets.has(key) && this.buckets.size >= this.capacity) {
      for (const [k, b] of this.buckets) if (b.expires <= now) this.buckets.delete(k);
      // Do not evict active buckets: doing so would let a flood bypass the limit.
      if (this.buckets.size >= this.capacity) return true;
    }
    times.push(now);
    this.buckets.set(key, { timestamps: times, expires: now + windowMs });
    return false;
  }
  reset(key: string) {
    this.buckets.delete(key);
  }
}
