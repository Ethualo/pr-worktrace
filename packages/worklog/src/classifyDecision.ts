import type { ReactionSummary } from "@pr-worktrace/github";
import type { Decision } from "./types.js";

export function classifyDecision(reactions: ReactionSummary): Decision {
  if (reactions.thumbsUp > reactions.thumbsDown) return "accepted";
  if (reactions.thumbsDown > reactions.thumbsUp) return "rejected";
  return "unclear";
}
