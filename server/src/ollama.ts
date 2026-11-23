import { readLines } from "./lines.ts";

export type OllamaChunk =
  | { type: "text"; text: string }
  | { type: "stats"; outputTokens: number; tokensPerSec: number };

interface ChatOptions {
  url: string;
  model: string;
  system: string;
  user: string;
  /** Maximum tokens the model may write. */
  numPredict: number;
  signal: AbortSignal;
}

/** One line of Ollama's streamed /api/chat response. */
interface ChatLine {
  message?: { content?: string };
  done?: boolean;
  error?: string;
  eval_count?: number;
  /** Nanoseconds. */
  eval_duration?: number;
}

/**
 * Streams a chat reply from Ollama: text pieces as they are written, then one stats item.
 * Aborting `signal` cancels the request, which makes Ollama stop generating.
 */
export async function* streamChat(options: ChatOptions): AsyncGenerator<OllamaChunk> {
  const response = await fetch(`${options.url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      model: options.model,
      stream: true,
      keep_alive: "30m",
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      options: { temperature: 0, num_thread: 2, num_predict: options.numPredict },
    }),
  });
  if (!response.ok || !response.body) throw new Error(`Ollama responded with ${response.status}`);

  for await (const line of readLines(response.body)) {
    if (!line.trim()) continue;
    const data = JSON.parse(line) as ChatLine;
    if (data.error) throw new Error(`Ollama error: ${data.error}`);
    if (data.message?.content) yield { type: "text", text: data.message.content };
    if (data.done) {
      const outputTokens = data.eval_count ?? 0;
      const seconds = (data.eval_duration ?? 0) / 1e9;
      yield { type: "stats", outputTokens, tokensPerSec: seconds > 0 ? outputTokens / seconds : 0 };
    }
  }
}
