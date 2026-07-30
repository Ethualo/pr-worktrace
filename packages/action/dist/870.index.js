export const id = 870;
export const ids = [870];
export const modules = {

/***/ 5870:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  createProvider: () => (/* binding */ createProvider)
});

// UNUSED EXPORTS: createClaudeProvider, createOpenAiProvider

// EXTERNAL MODULE: ../../node_modules/.pnpm/@anthropic-ai+sdk@0.30.1/node_modules/@anthropic-ai/sdk/index.mjs + 36 modules
var sdk = __webpack_require__(1638);
;// CONCATENATED MODULE: ../providers/dist/claudeProvider.js
const SYSTEM_PROMPT = `You review code diffs. Respond ONLY with JSON matching:
{"issues": [{"id": string, "severity": "low"|"medium"|"high"|"critical", "file": string, "line": number, "summary": string, "suggestion": string}]}
No prose, no markdown fences.`;
function createClaudeProvider(options) {
    return {
        name: "claude",
        async review(diff) {
            const response = await options.client.messages.create({
                model: options.model,
                max_tokens: 2048,
                system: SYSTEM_PROMPT,
                messages: [{ role: "user", content: diff }],
            });
            const textBlock = response.content.find((block) => block.type === "text");
            if (!textBlock || textBlock.type !== "text")
                return { issues: [] };
            try {
                const parsed = JSON.parse(textBlock.text);
                return { issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
            }
            catch {
                return { issues: [] };
            }
        },
    };
}

;// CONCATENATED MODULE: ../providers/dist/openaiProvider.js
const openaiProvider_SYSTEM_PROMPT = `You review code diffs. Respond ONLY with JSON matching:
{"issues": [{"id": string, "severity": "low"|"medium"|"high"|"critical", "file": string, "line": number, "summary": string, "suggestion": string}]}
No prose, no markdown fences.`;
function createOpenAiProvider(options) {
    const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    const fetchImpl = options.fetchImpl ?? fetch;
    return {
        name: "openai",
        async review(diff) {
            const response = await fetchImpl(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${options.apiKey}`,
                },
                body: JSON.stringify({
                    model: options.model,
                    messages: [
                        { role: "system", content: openaiProvider_SYSTEM_PROMPT },
                        { role: "user", content: diff },
                    ],
                }),
            });
            if (!response.ok) {
                throw new Error(`OpenAI-compatible API request failed: ${response.status} ${response.statusText}`);
            }
            const body = await response.json();
            const text = body.choices?.[0]?.message?.content;
            if (typeof text !== "string")
                return { issues: [] };
            try {
                const parsed = JSON.parse(text);
                return { issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
            }
            catch {
                return { issues: [] };
            }
        },
    };
}

;// CONCATENATED MODULE: ../providers/dist/index.js



function createProvider(config) {
    if (config.provider === "claude") {
        const client = new sdk/* default */.Ay({ apiKey: config.apiKey });
        return createClaudeProvider({ client, model: config.model });
    }
    if (config.provider === "openai") {
        return createOpenAiProvider({ apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl });
    }
    throw new Error(`Unknown provider: ${config.provider}`);
}




/***/ })

};
