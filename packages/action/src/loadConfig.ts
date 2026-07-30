import type { ProviderConfig } from "@worktrace/providers";

export interface LoadConfigParams {
  configJson: string;
  apiKey: string;
}

export function loadConfig(params: LoadConfigParams): ProviderConfig {
  const parsed = JSON.parse(params.configJson) as { provider?: string; model?: string; baseUrl?: string };

  if (parsed.provider !== "claude" && parsed.provider !== "openai") {
    throw new Error(`Invalid provider in config: ${String(parsed.provider)}`);
  }
  if (!parsed.model) {
    throw new Error("Missing model in config");
  }
  if (!params.apiKey) {
    throw new Error("Missing API key");
  }

  return { provider: parsed.provider, apiKey: params.apiKey, model: parsed.model, baseUrl: parsed.baseUrl };
}
