"use client";

import { Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
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
          <p className="max-h-[60vh] overflow-y-auto font-mono text-sm leading-7 break-words whitespace-pre-wrap">
            {entities.map((entity, index) => {
              const tag = tags[index];
              const previousEnd = index === 0 ? 0 : entities[index - 1].end;
              return (
                <Fragment key={`${entity.start}-${entity.end}`}>
                  {text.slice(previousEnd, entity.start)}
                  <button
                    type="button"
                    aria-pressed={entity.masked}
                    title={entity.masked ? `Masked as ${tag}. Click to keep visible.` : "Visible. Click to mask."}
                    onClick={() => dispatch(entityToggled(index))}
                    className={cn(
                      "rounded px-1 transition-colors",
                      entity.masked
                        ? "bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/25"
                        : "border border-dashed border-muted-foreground/50 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {entity.value}
                    {tag && <span className="ml-1.5 text-xs font-semibold text-primary">{tag}</span>}
                  </button>
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
