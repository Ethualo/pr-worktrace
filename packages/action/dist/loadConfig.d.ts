import type { ProviderConfig } from "@pr-worktrace/providers";
export interface LoadConfigParams {
    configJson: string;
    apiKey: string;
}
export declare function loadConfig(params: LoadConfigParams): ProviderConfig;
