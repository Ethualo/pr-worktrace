export interface AddedLine {
  line: number;
  content: string;
}

export interface DiffFile {
  path: string;
  addedLines: AddedLine[];
}

export function parseDiff(diffText: string): DiffFile[] {
  if (!diffText.trim()) return [];

  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let newLineNo = 0;

  for (const rawLine of diffText.split("\n")) {
    const fileHeaderMatch = rawLine.match(/^\+\+\+ b\/(.+)$/);
    if (fileHeaderMatch) {
      currentFile = { path: fileHeaderMatch[1], addedLines: [] };
      files.push(currentFile);
      continue;
    }

    const hunkMatch = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      newLineNo = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (!currentFile) continue;

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      currentFile.addedLines.push({ line: newLineNo, content: rawLine.slice(1) });
      newLineNo++;
    } else if (!rawLine.startsWith("-") && !rawLine.startsWith("---") && !rawLine.startsWith("diff") && !rawLine.startsWith("index")) {
      newLineNo++;
    }
  }

  return files;
}
