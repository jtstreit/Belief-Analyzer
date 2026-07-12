import OpenAI from "openai";

// OpenAI-compatible client for EXPLICITLY configured endpoints — in practice the
// local mock LLM (local-dev/mock-openai.cjs). There is no default provider: the
// DeepSeek fallback was removed per the 2026-07-11 plan of record (Vera runs on
// Claude). Lazy so the api-server can boot on the Claude Agent SDK backend with
// no OpenAI-compatible env configured at all.
let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY must be set to use the OpenAI-compatible backend.",
    );
  }
  if (!baseURL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set — there is no default OpenAI-compatible provider. Unset it entirely to use the Claude Agent SDK backend.",
    );
  }
  client = new OpenAI({ apiKey, baseURL });
  return client;
}
