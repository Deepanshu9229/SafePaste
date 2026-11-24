export interface Config {
  port: number;
  ollamaUrl: string;
  model: string;
  /** Origins allowed by CORS, e.g. ["https://safepaste.vercel.app"]. */
  corsOrigins: string[];
  turnstileSecret: string;
  /** Where usage rows are written, or null to turn usage logging off. */
  usageLog: { databaseUrl: string; hashSecret: string } | null;
  /** Longest accepted input, in characters. */
  maxTextLength: number;
  /** AI requests allowed per IP per minute. */
  requestsPerMinute: number;
  /** Requests allowed to wait while one is running. */
  maxWaiting: number;
  /** Longest a model run may take before the client gets a timeout error. */
  timeoutMs: number;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8080),
    ollamaUrl: env.OLLAMA_URL ?? "http://127.0.0.1:11434",
    model: env.OLLAMA_MODEL ?? "llama3.2:3b",
    corsOrigins: required(env, "CORS_ORIGINS")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    turnstileSecret: required(env, "TURNSTILE_SECRET"),
    // Logging is optional, but with a database the hash secret is required.
    usageLog: env.DATABASE_URL
      ? { databaseUrl: env.DATABASE_URL, hashSecret: required(env, "VISITOR_HASH_SECRET") }
      : null,
    maxTextLength: 1000,
    requestsPerMinute: 10,
    maxWaiting: 2,
    timeoutMs: 45_000,
  };
}
