// Vera's LLM provider. Plan of record (Jackson, 2026-08-09): every Vera call runs on
// Kimi K3 through the Kimi Code OpenAI-compatible API using Jackson's Kimi
// subscription OAuth (device-code login; KIMI_REFRESH_TOKEN refreshes short-lived
// access tokens in-process) — the zero-API-spend subscription pattern that replaced
// the retired Claude Max OAuth route. DeepSeek is removed; there is no default HTTP
// provider.
//
// Backend selection:
//   AI_INTEGRATIONS_OPENAI_BASE_URL set -> OpenAI-compatible endpoint. This is the
//     local verification seam (mock LLM at :8090); requires OPENAI_API_KEY.
//   KIMI_REFRESH_TOKEN set -> Kimi Code API (model `k3` by default).
//   otherwise -> Claude Agent SDK (legacy path, kept for rollback). The SDK is
//     Node-only and spawns a native binary, which is why this lives in the
//     server-only integrations package.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getOpenAI } from "./client";

export const DEFAULT_VERA_MODEL = "k3";

export type VeraMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface VeraCompleteOptions {
  /** System prompt (persona + output contract). */
  system: string;
  /** Conversation turns. A single user message for the analysis passes. */
  messages: VeraMessage[];
  /** Output cap — honored on the OpenAI-compatible path only. */
  maxTokens?: number;
  /**
   * Incremental text callback for SSE streaming. The OpenAI-compatible path
   * streams real deltas; the Agent SDK path emits the full text once (the SDK
   * returns a single result per query).
   */
  onDelta?: (text: string) => void;
}

function veraModel(): string {
  return process.env.VERA_MODEL?.trim() || DEFAULT_VERA_MODEL;
}

// ---------------------------------------------------------------------------
// Kimi Code backend (K3 on Jackson's Kimi subscription OAuth).
//
// The subscription login is an RFC 8628 device-code flow; its refresh token is
// injected as KIMI_REFRESH_TOKEN. Access tokens live ~15 minutes, so we keep one
// in-process and refresh ahead of expiry. The OAuth server rotates refresh tokens
// on refresh but keeps accepting the previous one, so the static env var remains a
// valid root of trust across restarts.
// ---------------------------------------------------------------------------

const KIMI_OAUTH_HOST =
  process.env.KIMI_OAUTH_HOST?.trim() || "https://auth.kimi.com";
const KIMI_CLIENT_ID =
  process.env.KIMI_CLIENT_ID?.trim() || "17e5f671-d194-4dfb-9706-5516cb48c098";
const KIMI_API_BASE =
  process.env.KIMI_API_BASE?.trim() || "https://api.kimi.com/coding/v1";

interface KimiTokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch seconds
}

let kimiTokens: KimiTokenState | null = null;
let kimiRefreshInFlight: Promise<KimiTokenState> | null = null;

function kimiConfigured(): boolean {
  return Boolean(process.env.KIMI_REFRESH_TOKEN?.trim());
}

async function refreshKimiTokens(force = false): Promise<KimiTokenState> {
  if (
    !force &&
    kimiTokens &&
    Date.now() / 1000 < kimiTokens.expiresAt - 120
  ) {
    return kimiTokens;
  }
  if (kimiRefreshInFlight) return kimiRefreshInFlight;
  const refreshToken = kimiTokens?.refreshToken || process.env.KIMI_REFRESH_TOKEN?.trim() || "";
  kimiRefreshInFlight = (async () => {
    try {
      const response = await fetch(`${KIMI_OAUTH_HOST}/api/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: KIMI_CLIENT_ID,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }).toString(),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Kimi OAuth refresh HTTP ${response.status}: ${body.slice(0, 200)}`);
      }
      const data: any = await response.json();
      if (typeof data?.access_token !== "string") {
        throw new Error("Kimi OAuth refresh returned no access_token.");
      }
      kimiTokens = {
        accessToken: data.access_token,
        refreshToken:
          typeof data.refresh_token === "string" && data.refresh_token
            ? data.refresh_token
            : refreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in || 900),
      };
      return kimiTokens;
    } finally {
      kimiRefreshInFlight = null;
    }
  })();
  return kimiRefreshInFlight;
}

async function kimiFetch(
  path: string,
  init: RequestInit,
  retriedAfterRefresh = false,
): Promise<Response> {
  const tokens = await refreshKimiTokens();
  const response = await fetch(`${KIMI_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string>),
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  });
  if (response.status === 401 && !retriedAfterRefresh) {
    await refreshKimiTokens(true);
    return kimiFetch(path, init, true);
  }
  return response;
}

async function runKimi(opts: VeraCompleteOptions): Promise<string> {
  const messages = [
    { role: "system" as const, content: opts.system },
    ...opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  if (opts.onDelta) {
    const response = await kimiFetch("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: veraModel(),
        max_tokens: opts.maxTokens,
        messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      throw new Error(`Kimi HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
    let full = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload);
          const content = chunk?.choices?.[0]?.delta?.content;
          if (typeof content === "string" && content) {
            full += content;
            opts.onDelta(content);
          }
        } catch {
          // Ignore keep-alive / partial frames.
        }
      }
    }
    if (!full.trim()) {
      throw new Error("Kimi returned no result text.");
    }
    return full;
  }

  const response = await kimiFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: veraModel(),
      max_tokens: opts.maxTokens,
      messages,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Kimi HTTP ${response.status}: ${body.slice(0, 300)}`);
  }
  const data: any = await response.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) {
    throw new Error("Kimi returned an empty response.");
  }
  return text;
}

async function runKimiWithRetries(opts: VeraCompleteOptions, attempt = 1): Promise<string> {
  try {
    return await runKimi(opts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isTransient(message) && attempt < 4) {
      const delayMs = 5000 * 2 ** (attempt - 1); // 5s, 10s, 20s
      console.log(
        `[vera-llm] kimi transient error (attempt ${attempt}/4): ${message.slice(0, 100)} — retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return runKimiWithRetries(opts, attempt + 1);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Claude Agent SDK backend (legacy, rollback-only).
// ---------------------------------------------------------------------------

// The Agent SDK subprocess inherits this env. Strip API keys so the SDK can NEVER
// prefer them over the subscription OAuth token (which would silently bill a
// pay-per-token API account).
function sdkEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    CLAUDE_CODE_MAX_RETRIES: "2",
  };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_API_KEY;
  return env;
}

// Only one SDK subprocess at a time: each query() spawns a Claude Code CLI process,
// and concurrent spawns can OOM a small instance. FIFO with a priority tier so a
// chat turn can jump ahead of a queued background analysis.
type SdkTask = {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  priority: number;
};
const sdkPending: SdkTask[] = [];
let sdkBusy = false;
function pumpSdkQueue(): void {
  if (sdkBusy || sdkPending.length === 0) return;
  let best = 0;
  for (let i = 1; i < sdkPending.length; i += 1) {
    if (sdkPending[i].priority > sdkPending[best].priority) best = i;
  }
  const task = sdkPending.splice(best, 1)[0];
  sdkBusy = true;
  task.run().then(
    (value) => {
      sdkBusy = false;
      task.resolve(value);
      pumpSdkQueue();
    },
    (error) => {
      sdkBusy = false;
      task.reject(error);
      pumpSdkQueue();
    },
  );
}
function withSdkSlot<T>(run: () => Promise<T>, priority = 0): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    sdkPending.push({
      run,
      resolve: resolve as (value: unknown) => void,
      reject,
      priority,
    });
    pumpSdkQueue();
  });
}

function isTransient(message: string): boolean {
  return /overloaded|rate.?limit|\b429\b|\b503\b|\b529\b|timeout|timed out|ECONNRESET|ECONNREFUSED|EPIPE|fetch failed|temporarily|connection (closed|error|reset)|socket hang up|other side closed|terminated|exited with code/i.test(
    message,
  );
}

// Render multi-turn history into a single prompt string — query() takes one
// prompt, not a message array. Single user message passes through untouched.
function renderPrompt(messages: VeraMessage[]): string {
  const turns = messages.filter((m) => m.role !== "system");
  if (turns.length === 1 && turns[0].role === "user") return turns[0].content;
  const transcript = turns
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n\n");
  return `${transcript}\n\n(Reply with the assistant's next message only, as plain text.)`;
}

async function runClaudeAttempt(
  system: string,
  prompt: string,
  model: string,
): Promise<string> {
  const stream = query({
    prompt,
    options: {
      model,
      systemPrompt: system,
      maxTurns: 1,
      allowedTools: [],
      disallowedTools: [],
      settingSources: [],
      // Adaptive thinking at medium effort — reasoning quality with acceptable
      // latency. Disabling thinking made the model drift off enums / emit
      // malformed JSON in CBT Sentinel testing, so thinking stays on.
      effort: "medium",
      strictMcpConfig: true,
      plugins: [],
      env: sdkEnv(),
    } as Record<string, unknown>,
  });

  let resultText: string | null = null;
  for await (const message of stream as AsyncIterable<Record<string, unknown>>) {
    if (message.type === "result") {
      if (message.subtype === "success" && typeof message.result === "string") {
        resultText = message.result;
        if (typeof message.total_cost_usd === "number") {
          console.log(
            `[vera-llm] result cost ~$${message.total_cost_usd.toFixed(4)}`,
          );
        }
      } else {
        const errors = Array.isArray(message.errors)
          ? message.errors.join("; ")
          : String(message.subtype);
        throw new Error(
          `Claude Agent SDK error (${String(message.subtype)}): ${errors}`,
        );
      }
      break;
    }
  }
  if (!resultText || !resultText.trim()) {
    throw new Error("Claude Agent SDK returned no result text.");
  }
  return resultText;
}

async function runClaude(
  opts: VeraCompleteOptions,
  attempt = 1,
): Promise<string> {
  const prompt = renderPrompt(opts.messages);
  const priority = opts.onDelta ? 1 : 0; // chat turns jump ahead of background scans
  try {
    return await withSdkSlot(
      () => runClaudeAttempt(opts.system, prompt, veraModel()),
      priority,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isTransient(message) && attempt < 4) {
      const delayMs = 5000 * 2 ** (attempt - 1); // 5s, 10s, 20s
      console.log(
        `[vera-llm] transient error (attempt ${attempt}/4): ${message.slice(0, 100)} — retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return runClaude(opts, attempt + 1);
    }
    throw error;
  }
}

async function runOpenAiCompatible(opts: VeraCompleteOptions): Promise<string> {
  const openai = getOpenAI();
  const messages = [
    { role: "system" as const, content: opts.system },
    ...opts.messages.filter((m) => m.role !== "system"),
  ];
  if (opts.onDelta) {
    const stream = await openai.chat.completions.create({
      model: veraModel(),
      max_completion_tokens: opts.maxTokens,
      messages,
      stream: true,
    });
    let full = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        full += content;
        opts.onDelta(content);
      }
    }
    return full;
  }
  const res = await openai.chat.completions.create({
    model: veraModel(),
    max_completion_tokens: opts.maxTokens,
    messages,
  });
  return res.choices[0]?.message?.content ?? "";
}

/**
 * One completion from Vera's LLM. Returns the full response text; if `onDelta`
 * is provided it is also invoked with incremental text as it becomes available.
 */
export async function veraComplete(opts: VeraCompleteOptions): Promise<string> {
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return runOpenAiCompatible(opts);
  }
  if (kimiConfigured()) {
    return runKimiWithRetries(opts);
  }
  const text = await runClaude(opts);
  opts.onDelta?.(text);
  return text;
}
