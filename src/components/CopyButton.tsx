"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  text: string;
  disabled?: boolean;
}

export default function CopyButton({ text, disabled }: CopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  // Reset the label 2 s after a copy attempt.
  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <Button size="sm" disabled={disabled} onClick={handleCopy}>
      {status === "copied" ? <Check /> : <Copy />}
      {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}
    </Button>
  );
}
