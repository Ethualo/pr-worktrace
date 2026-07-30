import type { WorkTraceEntry } from "./types.js";

export interface FormatWorklogMarkdownMeta {
  prNumber: number;
  date: string;
  repo: string;
}

function formatEntry(entry: WorkTraceEntry): string {
  const lines = [
    `## ${entry.issueId} — ${entry.decision}`,
    `- **File**: \`${entry.file}:${entry.line}\``,
    `- **Severity**: ${entry.severity}`,
    `- **AI Suggestion**: ${entry.summary} → ${entry.suggestion}`,
  ];
  if (entry.reason) {
    lines.push(`- **Reason**: ${entry.reason}`);
  }
  if (entry.commitId) {
    lines.push(`- **Commit**: \`${entry.commitId}\``);
  }
  return lines.join("\n");
}

export function formatWorklogMarkdown(entries: WorkTraceEntry[], meta: FormatWorklogMarkdownMeta): string {
  const heading = `# Work Trace — ${meta.repo} PR #${meta.prNumber} (${meta.date})`;

  if (entries.length === 0) {
    return `${heading}\n`;
  }

  const sections = entries.map(formatEntry).join("\n\n");
  return `${heading}\n\n${sections}\n`;
}
