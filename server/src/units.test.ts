import { describe, expect, it, vi } from "vitest";
import { LineSplitter } from "./lines.ts";
import { JobQueue } from "./queue.ts";
import { RateLimiter } from "./rateLimit.ts";
import { parseEntityLine } from "./scan.ts";
import { createUsageLogger, visitorHash, type UsageEntry } from "./usageLog.ts";

describe("LineSplitter", () => {
  it("returns complete lines and keeps the unfinished one", () => {
    const splitter = new LineSplitter();
    expect(splitter.push("one\ntw")).toEqual(["one"]);
    expect(splitter.push("o\nthree")).toEqual(["two"]);
    expect(splitter.flush()).toBe("three");
    expect(splitter.flush()).toBe("");
  });
});

describe("RateLimiter", () => {
  it("allows the limit, then says how long to wait", () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.check("ip", 0)).toBe(0);
    expect(limiter.check("ip", 1000)).toBe(0);
    expect(limiter.check("ip", 20_000)).toBe(40); // window ends at 60 s
  });

  it("counts each key separately and resets after the window", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.check("a", 0)).toBe(0);
    expect(limiter.check("b", 0)).toBe(0);
    expect(limiter.check("a", 59_999)).toBe(1);
    expect(limiter.check("a", 60_000)).toBe(0);
  });
});

describe("JobQueue", () => {
  it("runs one, lets two wait, and refuses the fourth", async () => {
    const queue = new JobQueue(2);
    const first = queue.join();
    const second = queue.join();
    const third = queue.join();

    expect([first?.position, second?.position, third?.position]).toEqual([0, 1, 2]);
    expect(queue.isFull).toBe(true);
    expect(queue.join()).toBeNull();
    expect(await first?.ready).toBe(true);
  });

  it("starts the next one when the running one leaves", async () => {
    const queue = new JobQueue(2);
    const first = queue.join();
    const second = queue.join();

    first?.leave();

    expect(await second?.ready).toBe(true);
    expect(queue.length).toBe(1);
  });

  it("lets a waiting one give up its place", async () => {
    const queue = new JobQueue(2);
    const first = queue.join();
    const second = queue.join();
    const third = queue.join();

    second?.leave();
    expect(await second?.ready).toBe(false);
    expect(queue.length).toBe(2);

    first?.leave();
    expect(await third?.ready).toBe(true);
  });

  it("ignores a second leave()", () => {
    const queue = new JobQueue(2);
    const first = queue.join();
    const second = queue.join();

    first?.leave();
    first?.leave(); // must not end the second one's turn

    expect(queue.length).toBe(1);
    second?.leave();
    expect(queue.length).toBe(0);
  });
});

describe("parseEntityLine", () => {
  const input = "Hi, I am Priya Sharma. I live at 12, MG Road, Pune 411005. PAN [PAN_1].";

  it("accepts a name or address that is in the input word for word", () => {
    expect(parseEntityLine('{"type":"PERSON","text":"Priya Sharma"}', input)).toEqual({
      type: "PERSON",
      text: "Priya Sharma",
    });
    expect(parseEntityLine('{"type":"ADDRESS","text":"12, MG Road, Pune 411005"},', input)).toEqual({
      type: "ADDRESS",
      text: "12, MG Road, Pune 411005",
    });
  });

  it("rejects text that is not in the input (grounding check)", () => {
    expect(parseEntityLine('{"type":"PERSON","text":"Rahul Verma"}', input)).toBeNull();
    expect(parseEntityLine('{"type":"PERSON","text":"priya sharma"}', input)).toBeNull();
  });

  it("rejects stop-list words, tags and very short text", () => {
    expect(parseEntityLine('{"type":"PERSON","text":"I"}', input)).toBeNull();
    expect(parseEntityLine('{"type":"PERSON","text":"[PAN_1]"}', input)).toBeNull();
    expect(parseEntityLine('{"type":"PERSON","text":"P"}', input)).toBeNull();
  });

  it("rejects lines that are not a valid entity object", () => {
    expect(parseEntityLine("Here are the names:", input)).toBeNull();
    expect(parseEntityLine("```json", input)).toBeNull();
    expect(parseEntityLine('{"type":"PERSON","text":"Priya', input)).toBeNull();
    expect(parseEntityLine('{"type":"EMAIL","text":"Priya Sharma"}', input)).toBeNull();
    expect(parseEntityLine('{"type":"PERSON","text":42}', input)).toBeNull();
    expect(parseEntityLine("", input)).toBeNull();
  });
});

describe("visitorHash", () => {
  const day1 = new Date("2026-11-24T10:00:00Z");

  it("is the same for one visitor within a day, and changes the next day", () => {
    const morning = visitorHash("203.0.113.7", day1, "secret");
    const evening = visitorHash("203.0.113.7", new Date("2026-11-24T23:59:00Z"), "secret");
    const nextDay = visitorHash("203.0.113.7", new Date("2026-11-25T00:00:00Z"), "secret");

    expect(evening).toBe(morning);
    expect(nextDay).not.toBe(morning);
  });

  it("differs per visitor and per secret, and does not contain the IP", () => {
    const hash = visitorHash("203.0.113.7", day1, "secret");

    expect(visitorHash("203.0.113.8", day1, "secret")).not.toBe(hash);
    expect(visitorHash("203.0.113.7", day1, "other-secret")).not.toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203");
  });
});

describe("createUsageLogger", () => {
  const entry: UsageEntry = {
    endpoint: "scan",
    status: "ok",
    model: "test-model",
    inputChars: 120,
    entityCounts: { PERSON: 2 },
    outputTokens: 40,
    tokensPerSec: 7.1,
    totalMs: 21000,
    ip: "203.0.113.7",
  };

  it("inserts one row with a visitor hash instead of the IP", () => {
    const query = vi.fn(async () => undefined);
    createUsageLogger({ query }, "secret")(entry);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("INSERT INTO usage_logs");
    expect(values.slice(0, 8)).toEqual(["scan", "ok", "test-model", 120, '{"PERSON":2}', 40, 7.1, 21000]);
    expect(values[8]).toMatch(/^[0-9a-f]{32}$/);
    expect(values).not.toContain("203.0.113.7");
  });

  it("does not throw when the database fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const query = vi.fn(async () => {
      throw new Error("database is down");
    });

    expect(() => createUsageLogger({ query }, "secret")(entry)).not.toThrow();
    await vi.waitFor(() => expect(errors).toHaveBeenCalledWith("usage log failed:", "database is down"));
    errors.mockRestore();
  });
});
