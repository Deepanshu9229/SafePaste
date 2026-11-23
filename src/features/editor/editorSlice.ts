import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface EditorState {
  text: string;
}

const initialState: EditorState = {
  text: "",
};

export const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    textChanged(state, action: PayloadAction<string>) {
      state.text = action.payload;
    },
  },
  selectors: {
    selectText: (state) => state.text,
  },
});

export const { textChanged } = editorSlice.actions;
export const { selectText } = editorSlice.selectors;
