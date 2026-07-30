export interface WorklogFilePathParams {
  date: string;
  prNumber: number;
}

export function worklogFilePath(params: WorklogFilePathParams): string {
  return `.worklog/${params.date}-pr${params.prNumber}.md`;
}
