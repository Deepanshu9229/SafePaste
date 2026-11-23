"use client";

import { Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import AiScan from "./AiScan";
import { entityToggled, selectDetectedText, selectEntities, selectMaskResult } from "./editorSlice";

export default function ReviewPanel() {
  const dispatch = useAppDispatch();
  const text = useAppSelector(selectDetectedText);
  const entities = useAppSelector(selectEntities);
  const { tags } = useAppSelector(selectMaskResult);
  const maskedCount = tags.filter((tag) => tag !== null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Review</CardTitle>
        <CardDescription>
          {entities.length === 0
            ? "Detected IDs will be highlighted here."
            : `${maskedCount} of ${entities.length} masked. Click a highlight to keep it visible.`}
        </CardDescription>
      </CardHeader>
      {text && (
        <CardContent>
          <AiScan />
          <p className="max-h-[60vh] overflow-y-auto font-mono text-sm leading-7 break-words whitespace-pre-wrap">
            {entities.map((entity, index) => {
              const tag = tags[index];
              const previousEnd = index === 0 ? 0 : entities[index - 1].end;
              return (
                <Fragment key={`${entity.start}-${entity.end}`}>
                  {text.slice(previousEnd, entity.start)}
                  {/* A span, not a <button>: buttons can't wrap, and addresses are longer than a line. */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-pressed={entity.masked}
                    title={entity.masked ? `Masked as ${tag}. Click to keep visible.` : "Visible. Click to mask."}
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
                    {tag && <span className="ml-1 text-[0.65rem] font-semibold text-primary">{tag}</span>}
                  </span>
                </Fragment>
              );
            })}
            {text.slice(entities.at(-1)?.end ?? 0)}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
