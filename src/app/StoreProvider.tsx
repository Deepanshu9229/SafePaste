"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/store/store";

export default function StoreProvider({ children }: { children: ReactNode }) {
  // Lazy initial state: the store is created once, on first render.
  const [store] = useState(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
