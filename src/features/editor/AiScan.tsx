"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IS_AI_ENABLED, MAX_AI_TEXT_LENGTH, TURNSTILE_SITE_KEY } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { aiScanFailed, scanWithAi, selectAiScan, selectIsDetecting, selectMaskResult, selectText } from "./editorSlice";

export default function AiScan() {
  const dispatch = useAppDispatch();
  const text = useAppSelector(selectText);
  const { maskedText } = useAppSelector(selectMaskResult);
  const isDetecting = useAppSelector(selectIsDetecting);
  const aiScan = useAppSelector(selectAiScan);
  const [isVerifying, setIsVerifying] = useState(false);
  const turnstile = useRef<TurnstileInstance>(null);
  const runningScan = useRef<{ abort: () => void } | null>(null);

  // A scan belongs to the text it was started for: stop it when the text changes or this panel goes away.
  useEffect(() => () => runningScan.current?.abort(), [text]);

  if (!IS_AI_ENABLED) return null;

  const isBusy = isVerifying || aiScan.status === "waiting" || aiScan.status === "scanning";
  const isTooLong = maskedText.length > MAX_AI_TEXT_LENGTH;

  async function handleScan() {
    setIsVerifying(true);
    try {
      // A Turnstile token works once, so every request gets a fresh one.
      turnstile.current?.reset();
      turnstile.current?.execute();
      const token = await turnstile.current?.getResponsePromise();
      if (!token) throw new Error("no token");
      runningScan.current = dispatch(scanWithAi(token));
    } catch {
      dispatch(aiScanFailed("The human check did not finish. Reload the page and try again."));
    } finally {
      setIsVerifying(false);
    }
  }

  let message = "Find names and addresses with AI. Only the masked text (step 3) is sent to SafePaste's own server.";
  if (isTooLong) {
    message = `AI scan accepts up to ${MAX_AI_TEXT_LENGTH} characters. The masked text has ${maskedText.length}.`;
  } else if (isVerifying) {
    message = "Checking that you are human…";
  } else if (aiScan.status === "waiting") {
    message = `Waiting in line (${aiScan.queuePosition} ahead)…`;
  } else if (aiScan.status === "scanning") {
    message = `Scanning… ${aiScan.foundCount} found so far. This can take up to 45 seconds.`;
  } else if (aiScan.status === "done") {
    const seconds = aiScan.totalMs === null ? "" : ` in ${Math.round(aiScan.totalMs / 1000)} s`;
    message = `AI scan finished${seconds}: ${aiScan.foundCount} new name(s) or address(es) masked.`;
  } else if (aiScan.status === "error") {
    message = aiScan.error ?? "The AI scan failed.";
  }

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-dashed p-2.5">
      <div className="flex items-center justify-between gap-3">
        <p
          aria-live="polite"
          className={cn("text-sm", aiScan.status === "error" ? "text-destructive" : "text-muted-foreground")}
        >
          {message}
        </p>
        {isBusy ? (
          <Button variant="outline" size="sm" onClick={() => runningScan.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={isDetecting || isTooLong || !maskedText} onClick={handleScan}>
            <Sparkles />
            AI scan
          </Button>
        )}
      </div>
      {/* Stays invisible unless Cloudflare needs the user to click a checkbox. */}
      <Turnstile
        ref={turnstile}
        siteKey={TURNSTILE_SITE_KEY}
        options={{ execution: "execute", appearance: "interaction-only" }}
      />
    </div>
  );
}
