"use client";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { detectEntities, selectText, textChanged } from "./editorSlice";

export default function PasteInput() {
  const dispatch = useAppDispatch();
  const text = useAppSelector(selectText);

  function handleChange(value: string) {
    dispatch(textChanged(value));
    void dispatch(detectEntities(value));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Paste your text</CardTitle>
        <CardDescription>IDs are found in your browser. This text is never sent anywhere.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" disabled={!text} onClick={() => handleChange("")}>
            Clear
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Textarea
          aria-label="Text to mask"
          placeholder="e.g. Hi, my PAN is ABCPE1234F and my number is +91 98765 43210."
          className="min-h-40 font-mono"
          value={text}
          onChange={(event) => handleChange(event.target.value)}
        />
      </CardContent>
    </Card>
  );
}
