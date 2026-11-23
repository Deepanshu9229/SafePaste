import { describe, expect, it } from "vitest";
import { detectAll } from "@/detectors/detectors";
import { makeStore } from "@/store/store";
import {
  aiEntityFound,
  aiScanQueued,
  detectEntities,
  entityToggled,
  replyChanged,
  scanWithAi,
  selectAiScan,
  selectEntities,
  selectIsDetecting,
  selectMaskResult,
  selectRestoredReply,
  textChanged,
} from "./editorSlice";

// The worker is not available in tests, so detection results are dispatched by hand.
function detected(text: string) {
  return detectEntities.fulfilled(detectAll(text), "test-request", text);
}

describe("editorSlice", () => {
  it("masks text once detection has finished", () => {
    const store = makeStore();
    store.dispatch(textChanged("PAN ABCPE1234F"));
    expect(selectIsDetecting(store.getState())).toBe(true);

    store.dispatch(detected("PAN ABCPE1234F"));

    expect(selectIsDetecting(store.getState())).toBe(false);
    expect(selectMaskResult(store.getState()).maskedText).toBe("PAN [PAN_1]");
  });

  it("ignores results for text that has changed since", () => {
    const store = makeStore();
    store.dispatch(textChanged("PAN ABCPE1234F"));
    store.dispatch(textChanged("PAN ABCPE1234F, call 9876543210"));

    store.dispatch(detected("PAN ABCPE1234F")); // stale result arrives late

    expect(selectEntities(store.getState())).toEqual([]);
    expect(selectIsDetecting(store.getState())).toBe(true);
  });

  it("never shows new, undetected text in the masked output", () => {
    const store = makeStore();
    store.dispatch(textChanged("PAN ABCPE1234F"));
    store.dispatch(detected("PAN ABCPE1234F"));

    store.dispatch(textChanged("PAN ABCPE1234F and XYZPK9876Q")); // detection not finished yet

    expect(selectMaskResult(store.getState()).maskedText).toBe("PAN [PAN_1]");
  });

  it("toggles an entity between masked and visible", () => {
    const store = makeStore();
    store.dispatch(textChanged("ABCPE1234F"));
    store.dispatch(detected("ABCPE1234F"));

    store.dispatch(entityToggled(0));
    expect(selectMaskResult(store.getState()).maskedText).toBe("ABCPE1234F");

    store.dispatch(entityToggled(0));
    expect(selectMaskResult(store.getState()).maskedText).toBe("[PAN_1]");
  });

  it("restores tags in the AI reply", () => {
    const store = makeStore();
    store.dispatch(textChanged("PAN ABCPE1234F"));
    store.dispatch(detected("PAN ABCPE1234F"));

    store.dispatch(replyChanged("Your PAN is PAN_1."));

    expect(selectRestoredReply(store.getState())).toBe("Your PAN is ABCPE1234F.");
  });
});

describe("AI scan", () => {
  const TEXT = "Priya Sharma has PAN ABCPE1234F. Call Priya Sharma or mail priya@example.com.";

  function storeWithText() {
    const store = makeStore();
    store.dispatch(textChanged(TEXT));
    store.dispatch(detected(TEXT));
    return store;
  }

  it("masks every occurrence of a name the AI found, with one tag", () => {
    const store = storeWithText();

    store.dispatch(aiEntityFound({ type: "PERSON", text: "Priya Sharma" }));

    expect(selectMaskResult(store.getState()).maskedText).toBe(
      "[PERSON_1] has PAN [PAN_1]. Call [PERSON_1] or mail [EMAIL_1].",
    );
    expect(selectAiScan(store.getState()).foundCount).toBe(1);
  });

  it("skips AI entities that overlap an existing one or are not in the text", () => {
    const store = storeWithText();

    store.dispatch(aiEntityFound({ type: "PERSON", text: "priya@example.com" })); // already an EMAIL
    store.dispatch(aiEntityFound({ type: "PERSON", text: "Rahul Verma" })); // not in the text
    store.dispatch(aiEntityFound({ type: "PERSON", text: "" }));

    expect(selectEntities(store.getState()).map((entity) => entity.type)).toEqual(["PAN", "EMAIL"]);
    expect(selectAiScan(store.getState()).foundCount).toBe(0);
  });

  it("tracks the scan status from start to finish", () => {
    const store = storeWithText();

    store.dispatch(scanWithAi.pending("request", "token"));
    expect(selectAiScan(store.getState()).status).toBe("scanning");

    store.dispatch(aiScanQueued(2));
    expect(selectAiScan(store.getState())).toMatchObject({ status: "waiting", queuePosition: 2 });

    store.dispatch(aiScanQueued(0));
    expect(selectAiScan(store.getState()).status).toBe("scanning");

    store.dispatch(scanWithAi.fulfilled(undefined, "request", "token"));
    expect(selectAiScan(store.getState()).status).toBe("done");
  });

  it("shows the server's message when the scan fails", () => {
    const store = storeWithText();

    store.dispatch(scanWithAi.rejected(new Error("The AI is busy. Try again in a minute."), "request", "token"));

    expect(selectAiScan(store.getState())).toMatchObject({
      status: "error",
      error: "The AI is busy. Try again in a minute.",
    });
  });

  it("forgets AI results when the text changes", () => {
    const store = storeWithText();
    store.dispatch(aiEntityFound({ type: "PERSON", text: "Priya Sharma" }));

    store.dispatch(textChanged("PAN ABCPE1234F"));
    store.dispatch(detected("PAN ABCPE1234F"));

    expect(selectEntities(store.getState()).map((entity) => entity.type)).toEqual(["PAN"]);
    expect(selectAiScan(store.getState()).status).toBe("idle");
  });
});
