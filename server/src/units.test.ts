import { describe, expect, it } from "vitest";
import { LineSplitter } from "./lines.ts";
import { JobQueue } from "./queue.ts";
import { RateLimiter } from "./rateLimit.ts";
import { parseEntityLine } from "./scan.ts";

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
