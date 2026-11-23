import { configureStore } from "@reduxjs/toolkit";
import { editorSlice } from "@/features/editor/editorSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      [editorSlice.reducerPath]: editorSlice.reducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
