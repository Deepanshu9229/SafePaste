export interface Ticket {
  /** Requests ahead of this one when it joined: 0 means it runs right away. */
  position: number;
  /** Resolves true when it is this ticket's turn, false if it left while waiting. */
  ready: Promise<boolean>;
  /** Give up the place (while waiting) or finish (while running). Safe to call twice. */
  leave: () => void;
}

interface Waiter {
  start: (isTurn: boolean) => void;
}

/** One request runs at a time; up to `maxWaiting` more wait in line. The CPU can't do more. */
export class JobQueue {
  private readonly maxWaiting: number;
  private running: Waiter | null = null;
  private readonly waiting: Waiter[] = [];

  constructor(maxWaiting: number) {
    this.maxWaiting = maxWaiting;
  }

  /** Running + waiting requests. */
  get length(): number {
    return (this.running ? 1 : 0) + this.waiting.length;
  }

  get isFull(): boolean {
    return this.running !== null && this.waiting.length >= this.maxWaiting;
  }

  /** Take a place in the queue, or null if it is full. */
  join(): Ticket | null {
    if (this.isFull) return null;

    let start: Waiter["start"] = () => {};
    const ready = new Promise<boolean>((resolve) => {
      start = resolve;
    });
    const waiter: Waiter = { start };
    const position = this.length;

    if (this.running) {
      this.waiting.push(waiter);
    } else {
      this.running = waiter;
      waiter.start(true);
    }

    return { position, ready, leave: () => this.leave(waiter) };
  }

  private leave(waiter: Waiter): void {
    if (this.running === waiter) {
      // Finished: the next one in line starts.
      this.running = this.waiting.shift() ?? null;
      this.running?.start(true);
      return;
    }
    const index = this.waiting.indexOf(waiter);
    if (index !== -1) {
      this.waiting.splice(index, 1);
      waiter.start(false);
    }
  }
}
