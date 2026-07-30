import type { ProviderConfig } from "@worktrace/providers";
export interface LoadConfigParams {
    configJson: string;
    apiKey: string;
}
export declare function loadConfig(params: LoadConfigParams): ProviderConfig;
