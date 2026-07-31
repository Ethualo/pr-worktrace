import { describe, it, expect } from "vitest";
import type { PostedComment, ReviewCommentThread } from "@pr-worktrace/github";
import { extractReasons } from "./extractReasons.js";
import { REASON_REQUEST_MARKER } from "./requestReasonForRejections.js";

describe("extractReasons", () => {
  const postedComments: PostedComment[] = [{ issueId: "issue-1", commentId: 100 }];

  it("extracts the human's reply text, ignoring the bot's own reason-request reply", () => {
    const threads: ReviewCommentThread[] = [
      { id: 100, body: "<!-- worktrace-issue:issue-1 -->\n**[high]** s\n\nsg" },
      { id: 101, body: `${REASON_REQUEST_MARKER}\n이유 한 줄만...`, inReplyToId: 100 },
      { id: 102, body: "false positive, this is intentional", inReplyToId: 100 },
    ];

    const reasons = extractReasons(threads, postedComments);

    expect(reasons).toEqual({ "issue-1": "false positive, this is intentional" });
  });

  it("returns no entry for an issue with no human reply yet", () => {
    const threads: ReviewCommentThread[] = [
      { id: 100, body: "<!-- worktrace-issue:issue-1 -->\n**[high]** s\n\nsg" },
      { id: 101, body: `${REASON_REQUEST_MARKER}\n이유 한 줄만...`, inReplyToId: 100 },
    ];

    const reasons = extractReasons(threads, postedComments);

    expect(reasons).toEqual({});
  });

  it("returns an empty object when there are no replies at all", () => {
    const threads: ReviewCommentThread[] = [{ id: 100, body: "<!-- worktrace-issue:issue-1 -->\n**[high]** s\n\nsg" }];

    const reasons = extractReasons(threads, postedComments);

    expect(reasons).toEqual({});
  });
});
