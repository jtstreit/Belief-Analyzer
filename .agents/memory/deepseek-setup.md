---
name: Vera LLM via veraComplete (Claude)
description: How every LLM call is made — veraComplete abstraction, Claude Agent SDK backend, mock seam. DeepSeek is REMOVED.
---

## Rule
Use `veraComplete` from `@workspace/integrations-openai-ai-server` for every LLM
call. Do NOT instantiate an OpenAI or Anthropic client directly, and do NOT
re-introduce DeepSeek or any hardcoded model string in route code.

**Why:** Plan of record (Jackson, 2026-07-11): Vera runs on Claude Opus 4.8 via
the Claude Agent SDK with a Max-subscription OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`)
— zero API spend. The abstraction keeps one backend switch:
`AI_INTEGRATIONS_OPENAI_BASE_URL` set → OpenAI-compatible endpoint (the local
mock LLM at :8090, the verification seam); unset → Claude Agent SDK.
Model override: `VERA_MODEL` (default `claude-opus-4-8`).

## How to apply
```typescript
import { veraComplete } from "@workspace/integrations-openai-ai-server";

const text = await veraComplete({
  system: systemPrompt,
  maxTokens: 3000,                       // honored on the compat path only
  messages: [{ role: "user", content: prompt }],
  onDelta: (chunk) => { /* optional SSE streaming */ },
});
```

Provider internals: `lib/integrations-openai-ai-server/src/vera.ts`
(single-subprocess queue, transient-error backoff, API-key stripping so the SDK
can never bill a pay-per-token account). Call sites: `cognitive.ts` (3 passes),
`patterns.ts`, `openai/index.ts` (chat SSE). Tests mock `veraComplete` directly.
