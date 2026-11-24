import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import type { Config } from "./config.ts";
import { startFakeOllama, type FakeOllama } from "./testing/fakeOllama.ts";
import type { UsageEntry } from "./usageLog.ts";

// The real Express app, talking to a fake Ollama. All text is synthetic.
// One HTTP server and one fake Ollama serve the whole file; each test installs its own app.

const TEXT = "Hi, I am Priya Sharma. I live at 12, MG Road, Pune 411005. PAN [PAN_1].";
const PRIYA = '{"type":"PERSON","text":"Priya Sharma"}\n';

let ollama: FakeOllama;
let server: Server;
let api: string;
let app: Express;
/** Usage rows the app has written in the current test. */
let usage: UsageEntry[];

/** Install a fresh app (new queue, new rate limiter); `overrides` change single config values. */
function startApi(overrides: Partial<Config> = {}): void {
  const config: Config = {
    port: 0,
    ollamaUrl: ollama.url,
    model: "test-model",
    corsOrigins: ["http://localhost:3000"],
    turnstileSecret: "unused",
    usageLog: null,
    maxTextLength: 1000,
    requestsPerMinute: 100,
    maxWaiting: 2,
    timeoutMs: 5000,
    ...overrides,
  };
  app = createApp({
    config,
    verifyTurnstile: async (token) => token === "good-token",
    logUsage: (entry) => usage.push(entry),
  });
}

function scan(body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(`${api}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    signal,
  });
}

/** Read a finished SSE response as a list of [event, data]. */
async function events(response: Response): Promise<[string, unknown][]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const [eventLine, dataLine] = block.split("\n");
      return [eventLine.replace("event: ", ""), JSON.parse(dataLine.replace("data: ", ""))];
    });
}

interface Health {
  status: string;
  model: string;
  lastTokensPerSec: number | null;
  queueLength: number;
}

async function health(): Promise<Health> {
  return (await (await fetch(`${api}/api/health`)).json()) as Health;
}

/** Wait until `check` is true (polls every 10 ms, gives up after 2 s). */
async function until(check: () => boolean | Promise<boolean>): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition was not met in time");
}

/** Make the fake Ollama keep replies open until the returned function is called. */
function holdOllama(): () => void {
  let release = () => {};
  ollama.gate = new Promise((resolve) => {
    release = resolve;
  });
  return release;
}

beforeAll(async () => {
  ollama = await startFakeOllama();
  server = http.createServer((req, res) => app(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await ollama.close();
});

beforeEach(() => {
  usage = [];
  ollama.chunks = [PRIYA];
  ollama.gate = Promise.resolve();
  ollama.requests = [];
  ollama.aborted = 0;
});

describe("GET /api/health", () => {
  it("reports status, model, speed and queue length", async () => {
    startApi();
    expect(await health()).toEqual({ status: "ok", model: "test-model", lastTokensPerSec: null, queueLength: 0 });
  });

  it("reports degraded when Ollama is down", async () => {
    startApi({ ollamaUrl: "http://127.0.0.1:9" }); // nothing listens on port 9
    expect((await health()).status).toBe("degraded");
  });
});

describe("POST /api/scan: rejected before the stream starts", () => {
  it("400 for missing, empty or too long text, or a missing token", async () => {
    startApi();
    expect((await scan({ turnstileToken: "good-token" })).status).toBe(400);
    expect((await scan({ text: "   ", turnstileToken: "good-token" })).status).toBe(400);
    expect((await scan({ text: "a".repeat(1001), turnstileToken: "good-token" })).status).toBe(400);
    expect((await scan({ text: TEXT })).status).toBe(400);
    expect((await scan("{not json")).status).toBe(400);
    expect(ollama.requests).toHaveLength(0);
    // Invalid JSON never reaches the handler, so 4 rows.
    expect(usage.map((row) => [row.status, row.inputChars])).toEqual([
      ["bad_request", 0],
      ["bad_request", 3],
      ["bad_request", 1001],
      ["bad_request", TEXT.length],
    ]);
  });

  it("413 for a body over 16 KB", async () => {
    startApi();
    expect((await scan({ text: "a".repeat(20_000), turnstileToken: "good-token" })).status).toBe(413);
  });

  it("403 when the Turnstile token is not valid", async () => {
    startApi();
    expect((await scan({ text: TEXT, turnstileToken: "bad-token" })).status).toBe(403);
    expect(ollama.requests).toHaveLength(0);
    expect(usage.map((row) => row.status)).toEqual(["forbidden"]);
  });

  it("429 with Retry-After once the per-IP limit is used up", async () => {
    startApi({ requestsPerMinute: 2 });
    await (await scan({ text: TEXT, turnstileToken: "good-token" })).text();
    await (await scan({ text: TEXT, turnstileToken: "good-token" })).text();

    const third = await scan({ text: TEXT, turnstileToken: "good-token" });

    expect(third.status).toBe(429);
    expect(Number(third.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(usage.map((row) => row.status)).toEqual(["ok", "ok", "rate_limited"]);
  });

  it("503 when one request is running and two are waiting", async () => {
    startApi();
    const release = holdOllama();
    const body = { text: TEXT, turnstileToken: "good-token" };

    const running = scan(body);
    await until(async () => (await health()).queueLength === 1);
    const waiting1 = scan(body);
    await until(async () => (await health()).queueLength === 2);
    const waiting2 = scan(body);
    await until(async () => (await health()).queueLength === 3);

    expect((await scan(body)).status).toBe(503);

    release();
    const [first, second, third] = await Promise.all([running, waiting1, waiting2].map(async (r) => events(await r)));
    expect(first[0]).toEqual(["queued", { position: 0 }]);
    expect(second.slice(0, 2)).toEqual([
      ["queued", { position: 1 }],
      ["queued", { position: 0 }],
    ]);
    expect(third[0]).toEqual(["queued", { position: 2 }]);
    expect(third.at(-1)).toEqual(["done", {}]);
    expect((await health()).queueLength).toBe(0);
    expect(usage.map((row) => row.status).sort()).toEqual(["busy", "ok", "ok", "ok"]);
  });
});

describe("POST /api/scan: the stream", () => {
  it("sends only valid, grounded, distinct entities, then stats and done", async () => {
    startApi();
    ollama.chunks = [
      "Here is the list:\n",
      PRIYA,
      '{"type":"ADDRESS","text":"12, MG Ro', // one line split over two pieces
      'ad, Pune 411005"}\n',
      '{"type":"PERSON","text":"Rahul Verma"}\n', // not in the input
      PRIYA, // duplicate
      '{"type":"PERSON","text":"[PAN_1]"}\n', // a masking tag
      '{"type":"PERSON","text":"Priya"}', // last line, no line break
    ];

    const response = await scan({ text: TEXT, turnstileToken: "good-token" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    const received = await events(response);
    expect(received.slice(0, 4)).toEqual([
      ["queued", { position: 0 }],
      ["entity", { type: "PERSON", text: "Priya Sharma" }],
      ["entity", { type: "ADDRESS", text: "12, MG Road, Pune 411005" }],
      ["entity", { type: "PERSON", text: "Priya" }],
    ]);
    expect(received[4][0]).toBe("stats");
    expect(received[4][1]).toMatchObject({ model: "test-model", outputTokens: 20, tokensPerSec: 5 });
    expect(received[5]).toEqual(["done", {}]);
    expect((await health()).lastTokensPerSec).toBe(5);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      endpoint: "scan",
      status: "ok",
      model: "test-model",
      inputChars: TEXT.length,
      entityCounts: { PERSON: 2, ADDRESS: 1 },
      outputTokens: 20,
      tokensPerSec: 5,
    });
    // The row has no field that could hold the text.
    expect(JSON.stringify(usage[0])).not.toContain("Priya");
  });

  it("calls Ollama with the settings from the brief", async () => {
    startApi();
    await (await scan({ text: TEXT, turnstileToken: "good-token" })).text();

    expect(ollama.requests[0]).toMatchObject({
      model: "test-model",
      stream: true,
      keep_alive: "30m",
      options: { temperature: 0, num_thread: 2, num_predict: 200 },
    });
    expect(ollama.requests[0]).not.toHaveProperty("format");
    const messages = ollama.requests[0].messages as { role: string; content: string }[];
    expect(messages[1]).toEqual({ role: "user", content: TEXT });
  });

  it("sends a timeout error event, keeping entities found so far", async () => {
    startApi({ timeoutMs: 150 });
    holdOllama(); // never released

    const received = await events(await scan({ text: TEXT, turnstileToken: "good-token" }));

    expect(received[1]).toEqual(["entity", { type: "PERSON", text: "Priya Sharma" }]);
    expect(received.at(-1)).toEqual(["error", { code: "timeout", message: "The scan took longer than 0 seconds." }]);
    expect(usage.map((row) => [row.status, row.entityCounts])).toEqual([["timeout", { PERSON: 1 }]]);
    expect((await health()).queueLength).toBe(0);
  });

  it("sends a model error event when Ollama fails", async () => {
    startApi({ ollamaUrl: "http://127.0.0.1:9" });

    const received = await events(await scan({ text: TEXT, turnstileToken: "good-token" }));

    expect(received.at(-1)).toEqual(["error", { code: "model", message: "The AI model is not available right now." }]);
    expect(usage.map((row) => row.status)).toEqual(["model_error"]);
  });

  it("stops the model and frees the queue when the client disconnects", async () => {
    startApi();
    holdOllama(); // never released
    const client = new AbortController();

    // fetch() resolves as soon as the stream opens; the body is still being read.
    const response = await scan({ text: TEXT, turnstileToken: "good-token" }, client.signal);
    await until(() => ollama.requests.length === 1);
    client.abort();

    await expect(response.text()).rejects.toThrow();
    await until(() => ollama.aborted === 1);
    await until(async () => (await health()).queueLength === 0);
    await until(() => usage.length === 1);
    expect(usage[0].status).toBe("aborted");
  });
});

describe("CORS", () => {
  it("allows only listed origins", async () => {
    startApi();
    const allowed = await fetch(`${api}/api/health`, { headers: { Origin: "http://localhost:3000" } });
    const other = await fetch(`${api}/api/health`, { headers: { Origin: "https://evil.example" } });

    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(allowed.headers.get("Access-Control-Expose-Headers")).toBe("Retry-After");
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
