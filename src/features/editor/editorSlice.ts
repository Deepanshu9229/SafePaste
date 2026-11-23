import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { detectInWorker } from "@/detectors/detectInWorker";
import { maskText, type Entity } from "@/masking/mask";
import { restoreText } from "@/masking/restore";

interface EditorState {
  /** What is in the textarea right now. */
  text: string;
  /** The text the current `entities` were detected in. Lags `text` while detection runs. */
  detectedText: string;
  /** Entities found in `detectedText`, sorted by position. */
  entities: Entity[];
  detectError: string | null;
  /** AI reply pasted on the Restore tab. */
  reply: string;
}

const initialState: EditorState = {
  text: "",
  detectedText: "",
  entities: [],
  detectError: null,
  reply: "",
};

/** Run the browser detectors (in a Web Worker) on `text`. */
export const detectEntities = createAsyncThunk("editor/detectEntities", (text: string) =>
  detectInWorker(text),
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(detectEntities.fulfilled, (state, action) => {
        // Ignore results for text the user has already changed.
        if (action.meta.arg !== state.text) return;
        state.detectedText = action.meta.arg;
        state.entities = action.payload.map((match) => ({ ...match, masked: true }));
        state.detectError = null;
      })
      .addCase(detectEntities.rejected, (state, action) => {
        if (action.meta.arg !== state.text) return;
        state.detectError = "Detection failed. Reload the page and try again.";
      });
  },
  selectors: {
    selectText: (state) => state.text,
    selectDetectedText: (state) => state.detectedText,
    selectEntities: (state) => state.entities,
    selectDetectError: (state) => state.detectError,
    selectReply: (state) => state.reply,
    /** True until detection has caught up with the textarea. */
    selectIsDetecting: (state) => state.text !== state.detectedText,
  },
});

export const { textChanged, entityToggled, replyChanged } = editorSlice.actions;
export const {
  selectText,
  selectDetectedText,
  selectEntities,
  selectDetectError,
  selectReply,
  selectIsDetecting,
} = editorSlice.selectors;

/** Masked text, tag map and per-entity tags. Derived, not stored. */
export const selectMaskResult = createSelector([selectDetectedText, selectEntities], maskText);

/** The AI reply with tags replaced by the original values. */
export const selectRestoredReply = createSelector([selectReply, selectMaskResult], (reply, mask) =>
  restoreText(reply, mask.tagMap),
);
