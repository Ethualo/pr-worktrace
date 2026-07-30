import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "@worktrace/core";
import { createClaudeProvider } from "./claudeProvider.js";
import { createOpenAiProvider } from "./openaiProvider.js";

export interface ProviderConfig {
  provider: "claude" | "openai";
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export function createProvider(config: ProviderConfig): LLMProvider {
  if (config.provider === "claude") {
    const client = new Anthropic({ apiKey: config.apiKey });
    return createClaudeProvider({ client, model: config.model });
  }
  if (config.provider === "openai") {
    return createOpenAiProvider({ apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl });
  }
  throw new Error(`Unknown provider: ${config.provider}`);
}

export { createClaudeProvider } from "./claudeProvider.js";
export type { ClaudeProviderOptions } from "./claudeProvider.js";
export { createOpenAiProvider } from "./openaiProvider.js";
export type { OpenAiProviderOptions } from "./openaiProvider.js";
