import http from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeOllama {
  url: string;
  /** Text pieces the "model" writes, in order. A line of output may be split across pieces. */
  chunks: string[];
  /** The reply only finishes after this resolves. Use it to keep a request running. */
  gate: Promise<void>;
  /** JSON bodies of the /api/chat requests received. */
  requests: Record<string, unknown>[];
  /** Requests the client cancelled before the reply finished. */
  aborted: number;
  close: () => Promise<void>;
}

/** A local HTTP server that answers like Ollama's /api/chat (streamed NDJSON) and /api/version. */
export async function startFakeOllama(): Promise<FakeOllama> {
  const fake: FakeOllama = {
    url: "",
    chunks: [],
    gate: Promise.resolve(),
    requests: [],
    aborted: 0,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };

  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/version") {
      res.end(JSON.stringify({ version: "fake" }));
      return;
    }

    let body = "";
    for await (const piece of req) body += piece;
    fake.requests.push(JSON.parse(body) as Record<string, unknown>);
    res.on("close", () => {
      if (!res.writableFinished) fake.aborted += 1;
    });

    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    for (const content of fake.chunks) {
      res.write(JSON.stringify({ message: { content }, done: false }) + "\n");
    }
    await fake.gate;
    if (res.destroyed) return;
    // 20 tokens in 4 seconds = 5 tokens/s.
    res.end(JSON.stringify({ done: true, eval_count: 20, eval_duration: 4e9 }) + "\n");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return fake;
}
