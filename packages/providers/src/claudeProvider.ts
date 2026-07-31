import type Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, ReviewResult } from "@pr-worktrace/core";

const SYSTEM_PROMPT = `You review code diffs. Respond ONLY with JSON matching:
{"issues": [{"id": string, "severity": "low"|"medium"|"high"|"critical", "file": string, "line": number, "summary": string, "suggestion": string}]}
No prose, no markdown fences.`;

export interface ClaudeProviderOptions {
  client: Anthropic;
  model: string;
}

export function createClaudeProvider(options: ClaudeProviderOptions): LLMProvider {
  return {
    name: "claude",
    async review(diff: string): Promise<ReviewResult> {
      const response = await options.client.messages.create({
        model: options.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: diff }],
      });

      const textBlock = response.content.find((block: any) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") return { issues: [] };

      try {
        const parsed = JSON.parse(textBlock.text);
        return { issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
      } catch {
        return { issues: [] };
      }
    },
  };
}
