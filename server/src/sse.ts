import type { Response } from "express";

export interface SseStream {
  send: (event: string, data: unknown) => void;
}

/** Starts a Server-Sent Events response. After this, errors must be sent as events. */
export function openSse(res: Response): SseStream {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  return {
    send(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
  };
}
