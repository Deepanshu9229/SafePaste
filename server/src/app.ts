import cors from "cors";
import express, { type ErrorRequestHandler, type Express } from "express";
import type { Config } from "./config.ts";
import { LineSplitter } from "./lines.ts";
import { streamChat } from "./ollama.ts";
import { JobQueue } from "./queue.ts";
import { RateLimiter } from "./rateLimit.ts";
import { parseEntityLine, SCAN_NUM_PREDICT, SCAN_SYSTEM_PROMPT } from "./scan.ts";
import { openSse } from "./sse.ts";
import type { VerifyTurnstile } from "./turnstile.ts";

interface AppDeps {
  config: Config;
  verifyTurnstile: VerifyTurnstile;
}

// Privacy rule: request text is never logged or stored anywhere in this file.
export function createApp({ config, verifyTurnstile }: AppDeps): Express {
  const app = express();
  const queue = new JobQueue(config.maxWaiting);
  const limiter = new RateLimiter(config.requestsPerMinute, 60_000);
  let lastTokensPerSec: number | null = null;

  // Caddy runs on this machine and sets X-Forwarded-For; trust that header only from loopback.
  app.set("trust proxy", "loopback");
  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ["Retry-After"] }));
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", async (_req, res) => {
    let ollamaUp = false;
    try {
      const response = await fetch(`${config.ollamaUrl}/api/version`, { signal: AbortSignal.timeout(2000) });
      ollamaUp = response.ok;
    } catch {
      ollamaUp = false;
    }
    res.json({
      status: ollamaUp ? "ok" : "degraded",
      model: config.model,
      lastTokensPerSec,
      queueLength: queue.length,
    });
  });

  app.post("/api/scan", async (req, res) => {
    // 1. Cheap checks first. Everything before openSse() answers with a normal HTTP status.
    const { text, turnstileToken } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof text !== "string" || text.trim() === "" || text.length > config.maxTextLength) {
      res.status(400).json({ error: `text must be 1 to ${config.maxTextLength} characters` });
      return;
    }
    if (typeof turnstileToken !== "string" || turnstileToken === "") {
      res.status(400).json({ error: "turnstileToken is required" });
      return;
    }

    const retryAfter = limiter.check(req.ip ?? "unknown");
    if (retryAfter > 0) {
      res.status(429).set("Retry-After", String(retryAfter)).json({ error: "Too many requests" });
      return;
    }
    if (queue.isFull) {
      res.status(503).json({ error: "The AI is busy. Try again in a minute." });
      return;
    }

    let isHuman: boolean;
    try {
      isHuman = await verifyTurnstile(turnstileToken, req.ip);
    } catch {
      res.status(503).json({ error: "Verification is unavailable. Try again in a minute." });
      return;
    }
    if (!isHuman) {
      res.status(403).json({ error: "Verification failed" });
      return;
    }

    // 2. Take a place in the queue (it may have filled up while Turnstile was checked).
    const ticket = queue.join();
    if (!ticket) {
      res.status(503).json({ error: "The AI is busy. Try again in a minute." });
      return;
    }

    // 3. Stream. If the client goes away, stop the model and free the queue place.
    const clientGone = new AbortController();
    res.on("close", () => {
      clientGone.abort();
      ticket.leave();
    });

    const sse = openSse(res);
    sse.send("queued", { position: ticket.position });

    const isTurn = await ticket.ready;
    if (!isTurn) return;
    if (ticket.position > 0) sse.send("queued", { position: 0 });

    const startedAt = Date.now();
    const timeout = AbortSignal.timeout(config.timeoutMs);
    const sent = new Set<string>();
    const sendEntity = (line: string) => {
      const entity = parseEntityLine(line, text);
      if (!entity) return;
      const key = `${entity.type}:${entity.text}`;
      if (sent.has(key)) return;
      sent.add(key);
      sse.send("entity", entity);
    };

    try {
      const splitter = new LineSplitter();
      let outputTokens = 0;
      let tokensPerSec = 0;

      const chunks = streamChat({
        url: config.ollamaUrl,
        model: config.model,
        system: SCAN_SYSTEM_PROMPT,
        user: text,
        numPredict: SCAN_NUM_PREDICT,
        signal: AbortSignal.any([clientGone.signal, timeout]),
      });
      for await (const chunk of chunks) {
        if (chunk.type === "text") {
          splitter.push(chunk.text).forEach(sendEntity);
        } else {
          outputTokens = chunk.outputTokens;
          tokensPerSec = chunk.tokensPerSec;
        }
      }
      sendEntity(splitter.flush());

      lastTokensPerSec = Math.round(tokensPerSec * 10) / 10;
      sse.send("stats", {
        model: config.model,
        outputTokens,
        tokensPerSec: lastTokensPerSec,
        totalMs: Date.now() - startedAt,
      });
      sse.send("done", {});
    } catch (error) {
      if (clientGone.signal.aborted) return;
      if (timeout.aborted) {
        const seconds = Math.round(config.timeoutMs / 1000);
        sse.send("error", { code: "timeout", message: `The scan took longer than ${seconds} seconds.` });
      } else {
        console.error("scan failed:", error instanceof Error ? error.message : error);
        sse.send("error", { code: "model", message: "The AI model is not available right now." });
      }
    } finally {
      ticket.leave();
      res.end();
    }
  });

  // Body-parser errors (invalid JSON, body over 16 KB) and anything unexpected.
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = typeof error?.status === "number" ? error.status : 500;
    if (status >= 500) console.error("request failed:", error instanceof Error ? error.message : error);
    const message = status === 413 ? "Request body too large" : status < 500 ? "Invalid request" : "Server error";
    res.status(status).json({ error: message });
  };
  app.use(handleError);

  return app;
}
