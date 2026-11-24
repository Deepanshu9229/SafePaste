"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import AiScan from "./AiScan";
import { entityToggled, selectDetectedText, selectEntities, selectionMasked, selectMaskResult } from "./editorSlice";

interface TextRange {
  start: number;
  end: number;
}

/**
 * Position in the review text of one end of the browser's selection.
 * Every piece of text is rendered in a span with `data-start` = its position in the text,
 * so the position is that number plus the offset inside the span's text node.
 */
function textPosition(node: Node, offset: number): number | null {
  const start = node.nodeType === Node.TEXT_NODE ? node.parentElement?.dataset.start : undefined;
  return start === undefined ? null : Number(start) + offset;
}

/** The part of the review text the user has selected, or null. */
function readSelection(container: HTMLElement | null): TextRange | null {
  const selection = window.getSelection();
  if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const start = textPosition(range.startContainer, range.startOffset);
  const end = textPosition(range.endContainer, range.endOffset);
  return start === null || end === null || end <= start ? null : { start, end };
}

export default function ReviewPanel() {
  const dispatch = useAppDispatch();
  const text = useAppSelector(selectDetectedText);
  const entities = useAppSelector(selectEntities);
  const { tags } = useAppSelector(selectMaskResult);
  const maskedCount = tags.filter((tag) => tag !== null).length;

  const reviewText = useRef<HTMLParagraphElement>(null);
  const [selected, setSelected] = useState<TextRange | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => setSelected(readSelection(reviewText.current));
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  // Maskable: at least 2 visible characters, and not touching an existing highlight.
  const canMaskSelection =
    selected !== null &&
    text.slice(selected.start, selected.end).trim().length >= 2 &&
    !entities.some((entity) => selected.start < entity.end && entity.start < selected.end);

  function handleMaskSelection() {
    if (!selected) return;
    dispatch(selectionMasked(selected));
    window.getSelection()?.removeAllRanges();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Review</CardTitle>
        <CardDescription>
          {entities.length === 0
            ? "Detected IDs will be highlighted here."
            : `${maskedCount} of ${entities.length} masked. Click a highlight to keep it visible.`}
          {text && " Select any other text to mask it."}
        </CardDescription>
        {text && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={!canMaskSelection}
              // Keep the text selected while the button is pressed.
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleMaskSelection}
            >
              Mask selection
            </Button>
          </CardAction>
        )}
      </CardHeader>
      {text && (
        <CardContent>
          <AiScan />
          <p
            ref={reviewText}
            className="max-h-[60vh] overflow-y-auto font-mono text-sm leading-7 break-words whitespace-pre-wrap"
          >
            {entities.map((entity, index) => {
              const tag = tags[index];
              const previousEnd = index === 0 ? 0 : entities[index - 1].end;
              return (
                <Fragment key={`${entity.start}-${entity.end}`}>
                  <span data-start={previousEnd}>{text.slice(previousEnd, entity.start)}</span>
                  {/* A span, not a <button>: buttons can't wrap, and addresses are longer than a line. */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-pressed={entity.masked}
                    title={entity.masked ? `Masked as ${tag}. Click to keep visible.` : "Visible. Click to mask."}
                    data-start={entity.start}
                    onClick={() => dispatch(entityToggled(index))}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      dispatch(entityToggled(index));
                    }}
                    className={cn(
                      "cursor-pointer rounded box-decoration-clone px-1 py-0.5 text-[0.8rem] transition-colors",
                      "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      entity.masked
                        ? "bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/25"
                        : "border border-dashed border-muted-foreground/50 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {entity.value}
                    {tag && (
                      <span className="ml-1 text-[0.65rem] font-semibold text-primary select-none">{tag}</span>
                    )}
                  </span>
                </Fragment>
              );
            })}
            <span data-start={entities.at(-1)?.end ?? 0}>{text.slice(entities.at(-1)?.end ?? 0)}</span>
          </p>
        </CardContent>
      )}
    </Card>
  );
}
