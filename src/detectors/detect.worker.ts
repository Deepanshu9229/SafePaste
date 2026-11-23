// Runs detectAll off the main thread so large pastes don't freeze the page.
import { detectAll } from "./detectors";
import type { DetectRequest, DetectResponse } from "./detectInWorker";

self.onmessage = (event: MessageEvent<DetectRequest>) => {
  const response: DetectResponse = { id: event.data.id, matches: detectAll(event.data.text) };
  self.postMessage(response);
};
