import type { LLMProvider, ReviewResult } from "@pr-worktrace/core";

const SYSTEM_PROMPT = `You review code diffs. Respond ONLY with JSON matching:
{"issues": [{"id": string, "severity": "low"|"medium"|"high"|"critical", "file": string, "line": number, "summary": string, "suggestion": string}]}
No prose, no markdown fences.`;

export interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  extraBody?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}

export function createOpenAiProvider(options: OpenAiProviderOptions): LLMProvider {
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: "openai",
    async review(diff: string): Promise<ReviewResult> {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          ...options.extraBody,
          model: options.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: diff },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI-compatible API request failed: ${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== "string") return { issues: [] };

      try {
        const parsed = JSON.parse(text);
        return { issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
      } catch {
        return { issues: [] };
      }
    },
  };
}
