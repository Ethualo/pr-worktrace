import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "@worktrace/core";
import { createClaudeProvider } from "./claudeProvider.js";

export interface ProviderConfig {
  provider: "claude" | "openai";
  apiKey: string;
  model: string;
}

export function createProvider(config: ProviderConfig): LLMProvider {
  if (config.provider === "claude") {
    const client = new Anthropic({ apiKey: config.apiKey });
    return createClaudeProvider({ client, model: config.model });
  }
  throw new Error(`Unknown provider: ${config.provider}`);
}

export { createClaudeProvider } from "./claudeProvider.js";
export type { ClaudeProviderOptions } from "./claudeProvider.js";
