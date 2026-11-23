/** Collects text that arrives in pieces and hands back complete lines. */
export class LineSplitter {
  private rest = "";

  /** Add a piece of text; returns the lines it completed (without the line break). */
  push(text: string): string[] {
    const parts = (this.rest + text).split("\n");
    this.rest = parts.pop() ?? "";
    return parts;
  }

  /** The unfinished last line. Call once, when the stream has ended. */
  flush(): string {
    const rest = this.rest;
    this.rest = "";
    return rest;
  }
}

/** Yields the lines of a byte stream (e.g. a fetch response body). */
export async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const splitter = new LineSplitter();
  for await (const bytes of stream) {
    yield* splitter.push(decoder.decode(bytes, { stream: true }));
  }
  const last = splitter.flush();
  if (last) yield last;
}
