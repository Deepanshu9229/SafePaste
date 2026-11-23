"use client";

import CopyButton from "@/components/CopyButton";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { replyChanged, selectMaskResult, selectReply, selectRestoredReply } from "./editorSlice";

export default function RestorePanel() {
  const dispatch = useAppDispatch();
  const reply = useAppSelector(selectReply);
  const restored = useAppSelector(selectRestoredReply);
  const { tagMap } = useAppSelector(selectMaskResult);
  const tagCount = Object.keys(tagMap).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>4. Paste the AI&apos;s reply</CardTitle>
          <CardDescription>
            {tagCount === 0
              ? "Mask some text on the Mask tab first. Its tags are what get restored."
              : `${tagCount} tag${tagCount === 1 ? "" : "s"} from your masked text can be restored.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            aria-label="AI reply"
            placeholder="e.g. Dear customer, your PAN [PAN_1] has been verified."
            className="max-h-[60vh] min-h-40 font-mono lg:h-[60vh]"
            value={reply}
            onChange={(event) => dispatch(replyChanged(event.target.value))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>5. Copy the restored reply</CardTitle>
          <CardDescription>Tags are replaced with your real values, in this browser only.</CardDescription>
          <CardAction>
            <CopyButton text={restored} disabled={!restored} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="max-h-[60vh] overflow-y-auto font-mono text-sm leading-7 break-words whitespace-pre-wrap">
            {restored || <span className="text-muted-foreground">The restored reply will appear here.</span>}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
