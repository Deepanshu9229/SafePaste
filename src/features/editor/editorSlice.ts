import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { detectInWorker } from "@/detectors/detectInWorker";
import { API_URL } from "@/lib/api";
import { AiRequestError, postSse } from "@/lib/sse";
import { maskText, type Entity } from "@/masking/mask";
import { restoreText } from "@/masking/restore";

interface AiScanState {
  /** waiting = in the server's queue; scanning = the model is working. */
  status: "idle" | "waiting" | "scanning" | "done" | "error";
  /** Requests ahead of this one in the server's queue. */
  queuePosition: number;
  /** Distinct names/addresses the scan has added so far. */
  foundCount: number;
  /** How long the model took, once it has finished. */
  totalMs: number | null;
  error: string | null;
}

interface EditorState {
  /** What is in the textarea right now. */
  text: string;
  /** The text the current `entities` were detected in. Lags `text` while detection runs. */
  detectedText: string;
  /** Entities found in `detectedText`, sorted by position. */
  entities: Entity[];
  detectError: string | null;
  aiScan: AiScanState;
  /** AI reply pasted on the Restore tab. */
  reply: string;
}

/** Entity as sent by POST /api/scan. */
interface AiEntity {
  type: "PERSON" | "ADDRESS";
  text: string;
}

const initialAiScan: AiScanState = {
  status: "idle",
  queuePosition: 0,
  foundCount: 0,
  totalMs: null,
  error: null,
};

const initialState: EditorState = {
  text: "",
  detectedText: "",
  entities: [],
  detectError: null,
  aiScan: initialAiScan,
  reply: "",
};

const createAppAsyncThunk = createAsyncThunk.withTypes<{ state: { editor: EditorState } }>();

/** Run the browser detectors (in a Web Worker) on `text`. */
export const detectEntities = createAppAsyncThunk("editor/detectEntities", (text: string) =>
  detectInWorker(text),
);

/**
 * Ask the server's model for names and addresses. Only the masked text is sent,
 * so IDs found by the browser detectors never leave the browser.
 */
export const scanWithAi = createAppAsyncThunk(
  "editor/scanWithAi",
  async (turnstileToken: string, { getState, dispatch, signal }) => {
    const text = selectMaskResult(getState()).maskedText;

    await postSse(
      `${API_URL}/api/scan`,
      { text, turnstileToken },
      {
        signal,
        onEvent(event, data) {
          switch (event) {
            case "queued":
              dispatch(aiScanQueued((data as { position: number }).position));
              break;
            case "entity":
              dispatch(aiEntityFound(data as AiEntity));
              break;
            case "stats":
              dispatch(aiScanTimed((data as { totalMs: number }).totalMs));
              break;
            case "error":
              throw new AiRequestError((data as { message: string }).message);
          }
        },
      },
    );
  },
);

export const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    textChanged(state, action: PayloadAction<string>) {
      state.text = action.payload;
    },
    entityToggled(state, action: PayloadAction<number>) {
      const entity = state.entities[action.payload];
      if (entity) entity.masked = !entity.masked;
    },
    replyChanged(state, action: PayloadAction<string>) {
      state.reply = action.payload;
    },
    aiScanQueued(state, action: PayloadAction<number>) {
      state.aiScan.queuePosition = action.payload;
      state.aiScan.status = action.payload > 0 ? "waiting" : "scanning";
    },
    /** Mask every occurrence of the entity's text that doesn't overlap an existing entity. */
    aiEntityFound(state, action: PayloadAction<AiEntity>) {
      const { type, text } = action.payload;
      if (!text) return;

      let added = false;
      let searchFrom = 0;
      for (;;) {
        const start = state.detectedText.indexOf(text, searchFrom);
        if (start === -1) break;
        const end = start + text.length;
        searchFrom = end;
        if (state.entities.some((entity) => start < entity.end && entity.start < end)) continue;
        state.entities.push({ type, start, end, value: text, masked: true });
        added = true;
      }

      if (added) {
        state.entities.sort((a, b) => a.start - b.start);
        state.aiScan.foundCount += 1;
      }
    },
    aiScanTimed(state, action: PayloadAction<number>) {
      state.aiScan.totalMs = action.payload;
    },
    aiScanFailed(state, action: PayloadAction<string>) {
      state.aiScan = { ...initialAiScan, status: "error", error: action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(detectEntities.fulfilled, (state, action) => {
        // Ignore results for text the user has already changed.
        if (action.meta.arg !== state.text) return;
        state.detectedText = action.meta.arg;
        state.entities = action.payload.map((match) => ({ ...match, masked: true }));
        state.detectError = null;
        // AI results belonged to the old text.
        state.aiScan = initialAiScan;
      })
      .addCase(detectEntities.rejected, (state, action) => {
        if (action.meta.arg !== state.text) return;
        state.detectError = "Detection failed. Reload the page and try again.";
      })
      .addCase(scanWithAi.pending, (state) => {
        state.aiScan = { ...initialAiScan, status: "scanning" };
      })
      .addCase(scanWithAi.fulfilled, (state) => {
        state.aiScan.status = "done";
      })
      .addCase(scanWithAi.rejected, (state, action) => {
        if (action.meta.aborted) {
          // Stopped by the user or because the text changed: keep what was found.
          state.aiScan.status = "idle";
          return;
        }
        state.aiScan.status = "error";
        state.aiScan.error = action.error.message ?? "The AI scan failed.";
      });
  },
  selectors: {
    selectText: (state) => state.text,
    selectDetectedText: (state) => state.detectedText,
    selectEntities: (state) => state.entities,
    selectDetectError: (state) => state.detectError,
    selectAiScan: (state) => state.aiScan,
    selectReply: (state) => state.reply,
    /** True until detection has caught up with the textarea. */
    selectIsDetecting: (state) => state.text !== state.detectedText,
  },
});

export const { textChanged, entityToggled, replyChanged, aiScanQueued, aiEntityFound, aiScanTimed, aiScanFailed } =
  editorSlice.actions;
export const {
  selectText,
  selectDetectedText,
  selectEntities,
  selectDetectError,
  selectAiScan,
  selectReply,
  selectIsDetecting,
} = editorSlice.selectors;

/** Masked text, tag map and per-entity tags. Derived, not stored. */
export const selectMaskResult = createSelector([selectDetectedText, selectEntities], maskText);

/** The AI reply with tags replaced by the original values. */
export const selectRestoredReply = createSelector([selectReply, selectMaskResult], (reply, mask) =>
  restoreText(reply, mask.tagMap),
);
