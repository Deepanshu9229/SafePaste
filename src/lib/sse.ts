import { fetchEventSource } from "@microsoft/fetch-event-source";

/** An AI request that failed, with a message that can be shown to the user. */
export class AiRequestError extends Error {}

interface PostSseOptions {
  signal: AbortSignal;
  /** Called for every server-sent event. Throw an AiRequestError to end the stream with an error. */
  onEvent: (event: string, data: unknown) => void;
}

/** Message for an HTTP error the API sent instead of starting a stream. */
function httpErrorMessage(response: Response): string {
  switch (response.status) {
    case 429: {
      const seconds = Number(response.headers.get("Retry-After"));
      return seconds > 0
        ? `Too many requests. Try again in ${seconds} seconds.`
        : "Too many requests. Try again in a minute.";
    }
    case 403:
      return "The human check failed. Reload the page and try again.";
    case 503:
      return "The AI is busy. Try again in a minute.";
    default:
      return "The AI server did not accept the request.";
  }
}

/**
 * POST `body` as JSON and read the answer as server-sent events.
 * The stream is never retried automatically: a retry would run the model a second time.
 */
export async function postSse(url: string, body: unknown, { signal, onEvent }: PostSseOptions): Promise<void> {
  await fetchEventSource(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    // Default is to close the stream when the tab is hidden and reopen it later (= a retry).
    openWhenHidden: true,
    async onopen(response) {
      if (!response.ok) throw new AiRequestError(httpErrorMessage(response));
    },
    onmessage(message) {
      if (message.event) onEvent(message.event, JSON.parse(message.data));
    },
    onerror(error) {
      // Throwing here is what stops the library from retrying.
      throw error instanceof AiRequestError ? error : new AiRequestError("Could not reach the AI server.");
    },
  });
}
