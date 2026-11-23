import type { Match } from "./types";

export interface DetectRequest {
  id: number;
  text: string;
}

export interface DetectResponse {
  id: number;
  matches: Match[];
}

interface PendingRequest {
  resolve: (matches: Match[]) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingRequest>();

/** One shared worker, created on first use (browser only). */
function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("./detect.worker.ts", import.meta.url));
  worker.onmessage = (event: MessageEvent<DetectResponse>) => {
    pending.get(event.data.id)?.resolve(event.data.matches);
    pending.delete(event.data.id);
  };
  worker.onerror = () => {
    for (const request of pending.values()) request.reject(new Error("Detector worker failed"));
    pending.clear();
  };
  return worker;
}

/** detectAll, run in a Web Worker. Each call gets its own id so replies can't mix up. */
export function detectInWorker(text: string): Promise<Match[]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text } satisfies DetectRequest);
  });
}
