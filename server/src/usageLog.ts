import { createHash } from "node:crypto";

/** How a request ended. */
export type UsageStatus =
  | "ok"
  | "bad_request" // 400
  | "forbidden" // 403, Turnstile failed
  | "rate_limited" // 429
  | "busy" // 503, queue full or Turnstile unreachable
  | "timeout"
  | "model_error"
  | "aborted"; // the client disconnected

/** One row of usage_logs. There is deliberately no field for the request text. */
export interface UsageEntry {
  endpoint: string;
  status: UsageStatus;
  model: string;
  inputChars: number;
  /** Entities sent to the client per type, e.g. { PERSON: 2, ADDRESS: 1 }. */
  entityCounts: Record<string, number>;
  outputTokens: number | null;
  tokensPerSec: number | null;
  /** From receiving the request to finishing it, queue wait included. */
  totalMs: number;
  /** Used only to compute the visitor hash; never stored. */
  ip: string | undefined;
}

/** Records one request. Never throws and never delays the response. */
export type LogUsage = (entry: UsageEntry) => void;

export const noUsageLog: LogUsage = () => {};

/** The part of pg.Pool that is used here. */
interface Database {
  query: (text: string, values: unknown[]) => Promise<unknown>;
}

/**
 * A stand-in for the IP address: the same visitor gets the same hash within one day (UTC),
 * and a different one the next day. Without the secret the IP cannot be worked out from it.
 */
export function visitorHash(ip: string | undefined, date: Date, secret: string): string {
  const day = date.toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip ?? "unknown"}|${day}|${secret}`).digest("hex").slice(0, 32);
}

const INSERT = `
  INSERT INTO usage_logs
    (endpoint, status, model, input_chars, entity_counts, output_tokens, tokens_per_sec, total_ms, visitor_hash)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

export function createUsageLogger(database: Database, hashSecret: string): LogUsage {
  return (entry) => {
    const values = [
      entry.endpoint,
      entry.status,
      entry.model,
      entry.inputChars,
      JSON.stringify(entry.entityCounts),
      entry.outputTokens,
      entry.tokensPerSec,
      entry.totalMs,
      visitorHash(entry.ip, new Date(), hashSecret),
    ];
    // Not awaited: a slow or broken database must not affect the user's request.
    database.query(INSERT, values).catch((error: unknown) => {
      console.error("usage log failed:", error instanceof Error ? error.message : error);
    });
  };
}
