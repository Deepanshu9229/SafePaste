interface Window {
  start: number;
  count: number;
}

/** In-memory request counter per key (IP): at most `limit` requests per `windowMs`. */
export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly windows = new Map<string, Window>();

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Counts one request. Returns 0 if it is allowed, otherwise the seconds to wait. */
  check(key: string, now: number = Date.now()): number {
    if (this.windows.size > 5000) this.removeExpired(now);

    const window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return 0;
    }
    if (window.count < this.limit) {
      window.count += 1;
      return 0;
    }
    return Math.ceil((window.start + this.windowMs - now) / 1000);
  }

  private removeExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
  }
}
