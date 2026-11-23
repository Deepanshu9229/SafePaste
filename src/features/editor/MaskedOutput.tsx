"use client";

import CopyButton from "@/components/CopyButton";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";
import { selectDetectError, selectIsDetecting, selectMaskResult } from "./editorSlice";

export default function MaskedOutput() {
  const { maskedText } = useAppSelector(selectMaskResult);
  const isDetecting = useAppSelector(selectIsDetecting);
  const detectError = useAppSelector(selectDetectError);

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Copy the masked text</CardTitle>
        <CardDescription>
          Paste it into ChatGPT or any AI tool. The real values stay in this browser tab.
        </CardDescription>
        <CardAction>
          {/* Disabled while detecting, so text that hasn't been checked can't be copied. */}
          <CopyButton text={maskedText} disabled={isDetecting || !maskedText} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {detectError ? (
          <p className="text-sm text-destructive">{detectError}</p>
        ) : (
          <p className="font-mono text-sm leading-7 break-words whitespace-pre-wrap">
            {maskedText || <span className="text-muted-foreground">The masked text will appear here.</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
