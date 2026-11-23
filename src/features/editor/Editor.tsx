"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectText, textChanged } from "./editorSlice";

export default function Editor() {
  const dispatch = useAppDispatch();
  const text = useAppSelector(selectText);

  return (
    <section className="flex flex-col gap-3">
      <Textarea
        aria-label="Text to mask"
        placeholder="Paste text with personal data here…"
        className="min-h-48 font-mono"
        value={text}
        onChange={(event) => dispatch(textChanged(event.target.value))}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {text.length} characters
        </span>
        <Button
          variant="outline"
          disabled={text.length === 0}
          onClick={() => dispatch(textChanged(""))}
        >
          Clear
        </Button>
      </div>
    </section>
  );
}
