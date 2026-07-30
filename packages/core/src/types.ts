export type Severity = "low" | "medium" | "high" | "critical";

export interface ReviewIssue {
  id: string;
  severity: Severity;
  file: string;
  line: number;
  summary: string;
  suggestion: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
}

export interface LLMProvider {
  name: string;
  review(diff: string): Promise<ReviewResult>;
}
