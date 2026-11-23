import { describe, expect, it } from "vitest";
import { detectAll } from "@/detectors/detectors";
import { makeStore } from "@/store/store";
import {
  detectEntities,
  entityToggled,
  replyChanged,
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
