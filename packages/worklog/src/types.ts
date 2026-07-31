import type { Severity } from "@pr-worktrace/core";

export type Decision = "accepted" | "rejected" | "unclear";

export interface WorkTraceEntry {
  issueId: string;
  file: string;
  line: number;
  severity: Severity;
  summary: string;
  suggestion: string;
  decision: Decision;
  reason?: string;
  commitId?: string;
}
